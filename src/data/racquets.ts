import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { RACQUET_USAGE_TAG, RACQUETS_TAG, racquetSetupsTag } from "@/data/cache-tags";
import type { Reviewer } from "@/data/reviewers";
import { getDb, type Database } from "@/db/client";
import { racquet, RACQUET_BRANDS, setup } from "@/db/schema";
import { qualified } from "@/db/sql";
import { racquetModel, racquetSlug } from "@/racquets/racquet-form";

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
 * Images are 1000x1500 WebP: the official face-on product shot, trimmed of
 * its uniform border, scaled so the racquet is 1410px tall (or 1000px wide,
 * if it is wider than that frame allows) and centred on an opaque white
 * canvas (Ben's decision). The four built-ins were prepared the same way (every racquet is
 * 27 in long), and `src/racquets/process-image.ts` does it for an added
 * photo, so they all match. The built-in ones are in /public/images/racquets;
 * an added one is in Vercel Blob (`src/racquets/image-store.ts`).
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

export interface BrandSection<R = Racquet> {
  brand: Brand;
  racquets: readonly R[];
}

/** Every brand in BRANDS order, including brands with none of `racquets`. */
function groupByBrand<R extends { brand: Brand }>(racquets: readonly R[]): BrandSection<R>[] {
  return BRANDS.map((brand) => ({
    brand,
    racquets: racquets.filter((found) => found.brand === brand),
  }));
}

/**
 * Every brand in BRANDS order, including brands with no racquets; racquets
 * within a brand in the order they were added (the built-in ones first).
 * Cached with the racquets tag, which every racquet write refreshes.
 */
export async function getRacquetsByBrand(): Promise<readonly BrandSection[]> {
  "use cache";
  cacheLife("max");
  cacheTag(RACQUETS_TAG);
  const rows = await getDb().select(racquetColumns).from(racquet).orderBy(asc(racquet.id));
  return groupByBrand(rows.map(toRacquet));
}

/**
 * Whether a setup uses the outer query's racquet, which stops it being
 * deleted. The columns are qualified (see `qualified`): a bare "id" in the
 * subquery would be the setup's id, not the racquet's.
 */
const RACQUET_IN_USE = sql<number>`EXISTS (
  SELECT 1 FROM ${setup} WHERE ${qualified(setup, setup.racquetId)} = ${qualified(racquet, racquet.id)}
)`;

export interface RacquetWithUsage extends Racquet {
  /** A setup uses it, so it can't be deleted. */
  inUse: boolean;
}

/**
 * `getRacquetsByBrand()` plus whether a setup uses each racquet, for
 * `/account/racquets` (and its edit page), which shows why a racquet can't be
 * deleted. Cached; refreshed with the racquets tag (edits, deletes, new
 * racquets) and the usage tag (a new setup, a review delete that removes its setup).
 */
export async function getRacquetsByBrandWithUsage(): Promise<readonly BrandSection<RacquetWithUsage>[]> {
  "use cache";
  cacheLife("max");
  cacheTag(RACQUETS_TAG, RACQUET_USAGE_TAG);
  const rows = await getDb()
    .select({ ...racquetColumns, inUse: RACQUET_IN_USE })
    .from(racquet)
    .orderBy(asc(racquet.id));
  return groupByBrand(rows.map((row) => ({ ...toRacquet(row), inUse: row.inUse === 1 })));
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

/**
 * Whether a racquet has this slug. Not cached: the Server Actions ask it at
 * request time.
 */
export async function racquetSlugExists(slug: string): Promise<boolean> {
  const [row] = await getDb().select({ id: racquet.id }).from(racquet).where(eq(racquet.slug, slug));
  return row !== undefined;
}

/**
 * A racquet's identity, the key that keeps two racquets from looking the
 * same: the slug its brand, model and year would make. The same
 * normalisation as the address (capitals, accents and punctuation don't
 * count), so "EZONE 98" and "ezone-98" are one racquet. A racquet's own slug
 * never changes, so after an edit its identity can differ from its slug,
 * and the two are compared separately below.
 */
function identityOf(brand: string, name: string, year: number): string | null {
  return racquetSlug(brand, racquetModel({ brand, name }), year);
}

/**
 * Whether another racquet (not `exceptId`) already has one of `keys` as its
 * slug or as its identity. A scan of the whole table is fine: it holds a few
 * dozen racquets, and an index can't see through the normalisation.
 */
async function keyTaken(
  db: Pick<Database, "select">,
  keys: readonly string[],
  exceptId: number | null,
): Promise<boolean> {
  const rows = await db
    .select({ id: racquet.id, slug: racquet.slug, brand: racquet.brand, name: racquet.name, year: racquet.year })
    .from(racquet);
  return rows.some((row) => {
    if (row.id === exceptId) return false;
    const identity = identityOf(row.brand, row.name, row.year);
    return keys.includes(row.slug) || (identity !== null && keys.includes(identity));
  });
}

/**
 * Whether a racquet other than `exceptSlug`'s already has this brand, model
 * and year. Not cached: the Server Actions ask it at request time, as a
 * cheap check before the expensive image work. The write checks again inside
 * its transaction, which is what decides a race.
 */
export async function racquetIdentityTaken(
  brand: Brand,
  name: string,
  year: number,
  exceptSlug: string | null = null,
): Promise<boolean> {
  const identity = identityOf(brand, name, year);
  if (identity === null) return false;
  const [except] =
    exceptSlug === null
      ? []
      : await getDb().select({ id: racquet.id }).from(racquet).where(eq(racquet.slug, exceptSlug));
  return keyTaken(getDb(), [identity], except?.id ?? null);
}

/** The text for a racquet photo's `alt`; an edit that keeps the photo keeps its alt. */
export function racquetImageAlt(name: string, year: number): string {
  return `${name} (${year}) racquet`;
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
 * Adds a racquet. A racquet that's already there, by slug or by brand, model
 * and year (checked inside the write transaction, so two reviewers adding the
 * same racquet at once can't both win), is refused, not overwritten. Only
 * from a Server Action (it refreshes pages with `updateTag`).
 */
export async function createRacquet(input: NewRacquet, author: Reviewer): Promise<CreateRacquetResult> {
  const { specs } = input;
  const result = await getDb().transaction(async (tx): Promise<CreateRacquetResult> => {
    const identity = identityOf(input.brand, input.name, input.year);
    if (await keyTaken(tx, identity === null ? [input.slug] : [input.slug, identity], null)) {
      return { status: "exists" };
    }
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

/** What an edit saves, already checked by `parseFields`. The slug and id are never changed. */
export interface RacquetEdit {
  /** Which racquet: found by it, never changed by it. */
  slug: string;
  brand: Brand;
  name: string;
  year: number;
  /** Blank specs are saved as null: an edit can remove a spec as well as set one. */
  specs: RacquetSpecs;
  /** The replacement photo's stored `src`, or null to keep the current one. */
  newImageSrc: string | null;
}

export type SaveRacquetEditResult =
  /** `replacedImageSrc`: the photo that was replaced (for the caller to remove), null when the photo was kept. */
  | { status: "saved"; replacedImageSrc: string | null }
  /** Another racquet already has this brand, model and year. */
  | { status: "exists" }
  | { status: "not-found" };

/**
 * Changes a racquet's brand, name, year, specs and, optionally, photo. Its
 * slug and id stay as they are, so links and setups keep working. The
 * duplicate check and the write share one transaction, so a rename can't
 * collide with a racquet added a moment earlier. The old photo's `src` is
 * read in the same transaction, so what the caller removes is exactly what
 * this edit replaced. Only from a Server Action (it refreshes pages with
 * `updateTag`).
 *
 * Only `RACQUETS_TAG` is refreshed: the setup cards show no racquet details
 * (`getRacquetSetups` carries the slug, which doesn't change), and the
 * racquet's own page, the lists and the review page's title all read the
 * catalogue through that tag.
 */
export async function saveRacquetEdit(input: RacquetEdit): Promise<SaveRacquetEditResult> {
  const { specs } = input;
  const result = await getDb().transaction(async (tx): Promise<SaveRacquetEditResult> => {
    const [current] = await tx
      .select({
        id: racquet.id,
        name: racquet.name,
        year: racquet.year,
        imageSrc: racquet.imageSrc,
        imageAlt: racquet.imageAlt,
      })
      .from(racquet)
      .where(eq(racquet.slug, input.slug));
    if (!current) return { status: "not-found" };

    // Its own slug doesn't count as taken: it stays, whatever the new name.
    const identity = identityOf(input.brand, input.name, input.year);
    if (identity !== null && (await keyTaken(tx, [identity], current.id))) return { status: "exists" };

    await tx
      .update(racquet)
      .set({
        brand: input.brand,
        name: input.name,
        year: input.year,
        imageSrc: input.newImageSrc ?? current.imageSrc,
        imageAlt: editedImageAlt(current, input),
        headSizeSqIn: specs.headSizeSqIn,
        weightGrams: specs.weightGrams,
        balanceMm: specs.balanceMm,
        lengthIn: specs.lengthIn,
        stringMains: specs.stringPattern?.mains ?? null,
        stringCrosses: specs.stringPattern?.crosses ?? null,
      })
      .where(eq(racquet.id, current.id));
    return { status: "saved", replacedImageSrc: input.newImageSrc === null ? null : current.imageSrc };
  });

  if (result.status === "saved") updateTag(RACQUETS_TAG);
  return result;
}

/**
 * The alt text after an edit. A new photo gets the plain text. A kept photo
 * keeps its alt (the built-ins describe their colours), with the old
 * "name (year)" at its start swapped for the new one when those changed, so
 * it never names a racquet the page no longer calls that.
 */
function editedImageAlt(
  current: { name: string; year: number; imageAlt: string },
  input: Pick<RacquetEdit, "name" | "year" | "newImageSrc">,
): string {
  if (input.newImageSrc !== null) return racquetImageAlt(input.name, input.year);
  if (current.name === input.name && current.year === input.year) return current.imageAlt;
  const oldStart = `${current.name} (${current.year})`;
  return current.imageAlt.startsWith(oldStart)
    ? `${input.name} (${input.year})${current.imageAlt.slice(oldStart.length)}`
    : racquetImageAlt(input.name, input.year);
}

export type RemoveRacquetResult =
  /** `imageSrc`: the deleted racquet's photo, for the caller to remove. */
  | { status: "deleted"; imageSrc: string }
  | { status: "in-use" }
  | { status: "already-gone" };

/**
 * Deletes a racquet no setup uses. The check and the delete are one
 * statement in one write transaction, so a setup added a moment earlier
 * can't be orphaned (the RESTRICT foreign key stays as the backstop). A slug
 * that's already gone is reported, not an error, so a double-submitted Delete
 * can count as done. Only from a Server Action (it refreshes pages with
 * `updateTag`).
 */
export async function removeRacquet(slug: string): Promise<RemoveRacquetResult> {
  const result = await getDb().transaction(async (tx): Promise<RemoveRacquetResult> => {
    const deleted = await tx
      .delete(racquet)
      .where(and(eq(racquet.slug, slug), sql`NOT ${RACQUET_IN_USE}`))
      .returning({ imageSrc: racquet.imageSrc });
    if (deleted.length > 0) return { status: "deleted", imageSrc: deleted[0].imageSrc };
    const [still] = await tx.select({ id: racquet.id }).from(racquet).where(eq(racquet.slug, slug));
    return still ? { status: "in-use" } : { status: "already-gone" };
  });

  if (result.status === "deleted") {
    // The page, the lists and the slug list (generateStaticParams) all carry
    // this tag, so the page stops existing and /racquets drops it.
    updateTag(RACQUETS_TAG);
    updateTag(racquetSetupsTag(slug));
  }
  return result;
}
