import "server-only";
import { asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { RACQUETS_TAG, racquetSetupsTag } from "@/data/cache-tags";
import type { Reviewer } from "@/data/reviewers";
import { getDb } from "@/db/client";
import { racquet, RACQUET_BRANDS } from "@/db/schema";

/**
 * The racquet catalogue. The four built-in racquets (migration
 * `0006_racquets_in_database`, which also keeps the pages their specs came
 * from) and every racquet a reviewer adds live in the `racquet` table, so
 * there is one source. Pages only talk to the async accessors below.
 *
 * Specs come only from the manufacturer's official product page (Product
 * rules 10 and 11); no source link is kept. Every racquet has the same five
 * specs; one the manufacturer doesn't publish is `null`, left out rather
 * than guessed. Extras (Babolat's swingweight, stiffness) are deliberately
 * not stored.
 *
 * Images are 1000x1500 WebP: the official face-on product shot, scaled to
 * fit and centred at the top of a transparent canvas. The canvas is the same
 * for every racquet; how large the racquet is in it depends on the photo,
 * because an added photo's margins aren't trimmed. The four built-ins were
 * trimmed and scaled to the same 1410px frame height (every racquet is 27 in
 * long) before being centred on the canvas, so they match each other. The
 * built-in ones are in /public/images/racquets; an added one is in Vercel
 * Blob (`src/racquets/image-store.ts`).
 */

/** Brands in display order. Every brand gets a section, even with no racquets. */
export const BRANDS = RACQUET_BRANDS;
export type Brand = (typeof BRANDS)[number];

export interface RacquetSpecs {
  /** Head size in square inches. */
  headSizeSqIn: number | null;
  /** Unstrung, in grams, as published. Grams only, never ounces (Product rule 11). */
  weightGrams: number | null;
  /** Balance point in millimetres from the butt cap. */
  balanceMm: number | null;
  lengthIn: number | null;
  stringPattern: { mains: number; crosses: number } | null;
}

/** The canvas every racquet photo sits on (`docs/vision.md`, "Adding a racquet"). */
export const IMAGE_SIZE = { width: 1000, height: 1500 } as const;

export interface RacquetImage {
  /** A path under /public, or an absolute Vercel Blob URL. */
  src: string;
  width: number;
  height: number;
  alt: string;
}

export interface Racquet {
  /** URL slug, `brand-model-year`. */
  slug: string;
  brand: Brand;
  /**
   * Full name, which starts with `brand`, e.g. "Yonex EZONE 98". Cards
   * under a brand heading strip the brand off (`modelName` in racquet-list.tsx).
   */
  name: string;
  /** Model year of this generation. */
  year: number;
  /** Generation label where the manufacturer's page states it, e.g. "7th gen". */
  generation: string | null;
  image: RacquetImage;
  specs: RacquetSpecs;
}

const racquetColumns = {
  slug: racquet.slug,
  brand: racquet.brand,
  name: racquet.name,
  year: racquet.year,
  generation: racquet.generation,
  imageSrc: racquet.imageSrc,
  imageAlt: racquet.imageAlt,
  headSizeSqIn: racquet.headSizeSqIn,
  weightGrams: racquet.weightGrams,
  balanceMm: racquet.balanceMm,
  lengthIn: racquet.lengthIn,
  stringMains: racquet.stringMains,
  stringCrosses: racquet.stringCrosses,
};

type RacquetRow = Pick<typeof racquet.$inferSelect, keyof typeof racquetColumns>;

function toRacquet(row: RacquetRow): Racquet {
  return {
    slug: row.slug,
    brand: row.brand,
    name: row.name,
    year: row.year,
    generation: row.generation,
    image: { src: row.imageSrc, ...IMAGE_SIZE, alt: row.imageAlt },
    specs: {
      headSizeSqIn: row.headSizeSqIn,
      weightGrams: row.weightGrams,
      balanceMm: row.balanceMm,
      lengthIn: row.lengthIn,
      // The table keeps the pair together (`racquet_string_pattern_pair`).
      stringPattern:
        row.stringMains !== null && row.stringCrosses !== null
          ? { mains: row.stringMains, crosses: row.stringCrosses }
          : null,
    },
  };
}

export interface BrandSection {
  brand: Brand;
  racquets: readonly Racquet[];
}

/**
 * Every brand in BRANDS order, including brands with no racquets; racquets
 * within a brand in the order they were added (the built-in ones first).
 * Cached with the racquets tag, which `createRacquet` refreshes.
 */
export async function getRacquetsByBrand(): Promise<readonly BrandSection[]> {
  "use cache";
  cacheLife("max");
  cacheTag(RACQUETS_TAG);
  const rows = await getDb().select(racquetColumns).from(racquet).orderBy(asc(racquet.id));
  const racquets = rows.map(toRacquet);
  return BRANDS.map((brand) => ({
    brand,
    racquets: racquets.filter((found) => found.brand === brand),
  }));
}

export async function getRacquet(slug: string): Promise<Racquet | undefined> {
  "use cache";
  cacheLife("max");
  cacheTag(RACQUETS_TAG);
  const [row] = await getDb().select(racquetColumns).from(racquet).where(eq(racquet.slug, slug));
  return row && toRacquet(row);
}

export async function getRacquetSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("max");
  cacheTag(RACQUETS_TAG);
  const rows = await getDb().select({ slug: racquet.slug }).from(racquet).orderBy(asc(racquet.id));
  return rows.map((row) => row.slug);
}

/** Whether a racquet has this slug. Not cached: the Server Action asks it at request time. */
export async function racquetSlugExists(slug: string): Promise<boolean> {
  const [row] = await getDb().select({ id: racquet.id }).from(racquet).where(eq(racquet.slug, slug));
  return row !== undefined;
}

/** A racquet to add, already checked by `parseFields` (`src/racquets/submit.ts`). */
export interface NewRacquet {
  slug: string;
  brand: Brand;
  name: string;
  year: number;
  image: { src: string; alt: string };
  specs: RacquetSpecs;
}

export type CreateRacquetResult = { status: "created"; slug: string } | { status: "exists" };

/**
 * Adds a racquet. A slug that's taken (checked inside the write transaction,
 * so two reviewers adding the same racquet at once can't both win) is
 * refused, not overwritten. Racquets can't be edited or deleted. Only from
 * a Server Action (it refreshes pages with `updateTag`).
 */
export async function createRacquet(input: NewRacquet, author: Reviewer): Promise<CreateRacquetResult> {
  const { specs } = input;
  const result = await getDb().transaction(async (tx): Promise<CreateRacquetResult> => {
    const [taken] = await tx.select({ id: racquet.id }).from(racquet).where(eq(racquet.slug, input.slug));
    if (taken) return { status: "exists" };
    await tx.insert(racquet).values({
      slug: input.slug,
      brand: input.brand,
      name: input.name,
      year: input.year,
      imageSrc: input.image.src,
      imageAlt: input.image.alt,
      headSizeSqIn: specs.headSizeSqIn,
      weightGrams: specs.weightGrams,
      balanceMm: specs.balanceMm,
      lengthIn: specs.lengthIn,
      stringMains: specs.stringPattern?.mains ?? null,
      stringCrosses: specs.stringPattern?.crosses ?? null,
      createdBy: author.id,
    });
    return { status: "created", slug: input.slug };
  });

  if (result.status === "created") {
    // The brand sections on / and /racquets, the racquet's own page and the
    // slug list (generateStaticParams) all carry this tag.
    updateTag(RACQUETS_TAG);
    // A visit to the slug before it existed may have cached an empty setup list for it.
    updateTag(racquetSetupsTag(input.slug));
  }
  return result;
}
