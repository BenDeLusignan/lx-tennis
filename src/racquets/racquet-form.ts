/**
 * The "add a racquet" form's contract: field names, limits and the `?error=`
 * flags. Pure (no `server-only`), like `src/data/units.ts`, so the page can
 * use the same numbers for its HTML checks (`min`, `max`, `step`,
 * `maxLength`, `accept`) that the Server Action enforces.
 *
 * The ranges in `RACQUET_LIMITS` are the form's. The `racquet` table repeats
 * them as sanity checks (`src/db/schema.ts`); change them together.
 */

/** Where the form lives, and where every refusal goes back to. */
export const NEW_RACQUET_PATH = "/account/racquets/new";

/** The form's field names. The page and the Server Action both read them from here. */
export const RACQUET_FIELDS = {
  brand: "brand",
  /** The model without the brand: "EZONE 98". The racquet's name is "Yonex EZONE 98". */
  model: "model",
  year: "year",
  headSize: "headSize",
  weightGrams: "weightGrams",
  weightOunces: "weightOunces",
  balanceMm: "balanceMm",
  lengthIn: "lengthIn",
  stringMains: "stringMains",
  stringCrosses: "stringCrosses",
  sourceUrl: "sourceUrl",
  image: "image",
} as const;

/**
 * Limits per field. `min`/`max`/`step` are in the unit the field is typed in
 * (see the labels below). The earliest year is a sanity floor; the latest is
 * next year, worked out when the form is checked (`maxRacquetYear`), so
 * the page should leave `max` off the year input rather than freeze a
 * year into the prerendered page.
 */
export const RACQUET_LIMITS = {
  model: { maxLength: 60 },
  year: { min: 1990, step: 1 },
  /** Square inches. */
  headSize: { min: 70, max: 140, step: 1 },
  /** Unstrung, grams, as the manufacturer publishes it. */
  weightGrams: { min: 150, max: 450, step: 1 },
  /** Unstrung, ounces, as published: up to 4 decimals (Babolat publishes 10.7586). */
  weightOunces: { min: 5, max: 16, step: 0.0001 },
  /** Millimetres from the butt cap. */
  balanceMm: { min: 200, max: 450, step: 1 },
  /** Inches, up to 2 decimals (27.25). */
  lengthIn: { min: 17, max: 29, step: 0.01 },
  /** Mains and crosses, each. Both or neither. */
  stringPattern: { min: 12, max: 24, step: 1 },
  sourceUrl: { maxLength: 500 },
} as const;

/** The latest model year accepted: next year, since racquets are announced ahead. */
export function maxRacquetYear(now: Date = new Date()): number {
  return now.getUTCFullYear() + 1;
}

/**
 * The image's limit is the size of the upload: Vercel refuses a function
 * request body over 4.5 MB, so the file is capped below that (the other
 * fields are a few hundred bytes). `serverActions.bodySizeLimit` in
 * `next.config.ts` sits just above this so our own message shows first.
 */
export const IMAGE_MAX_BYTES = 4_000_000;

/**
 * The formats the server reads, the one list behind both the file input's
 * `accept` and the server's check of what an upload really is (sharp's
 * `metadata()`). sharp's prebuilt libvips has no HEIC, and it reports AVIF
 * as format `heif` with compression `av1` (HEIC is `heif` with `hevc`), hence
 * `compression`. SVG is left out: it's code to render, not a photo.
 */
export const IMAGE_TYPES = [
  { mime: "image/jpeg", format: "jpeg" },
  { mime: "image/png", format: "png" },
  { mime: "image/webp", format: "webp" },
  { mime: "image/gif", format: "gif" },
  { mime: "image/avif", format: "heif", compression: "av1" },
] as const;

/** For the file input's `accept`. */
export const IMAGE_ACCEPT = IMAGE_TYPES.map((type) => type.mime).join(",");

/**
 * Every `?error=` flag the form can come back with. Nothing was saved in any
 * of these cases, and the page's message for each should say so.
 *
 * - `invalid`: the request isn't something the form could send: a field that
 *   should be text arrived as a file, or the image field arrived as text.
 *   (A field that is simply missing counts as blank, and gets its own flag.)
 * - `brand`: missing, or not one of `BRANDS`.
 * - `model`: blank, too long, or nothing in it a URL can carry (all symbols),
 *   or so long that its slug would exceed `RACQUET_SLUG_MAX_LENGTH`.
 * - `year`: not a whole year from 1990 to next year.
 * - `head-size`, `weight` (grams or ounces), `balance`, `length`:
 *   not a number, too many decimals, or out of range.
 * - `string-pattern`: only one of mains and crosses given, or out of range.
 * - `source`: specs were given without an official source link, or the link
 *   isn't an https address (Product rule 10).
 * - `image-missing`: no file chosen.
 * - `image-type`: not a readable JPEG, PNG, WebP, GIF or AVIF.
 * - `image-size`: over `IMAGE_MAX_BYTES`.
 * - `exists`: a racquet with the same brand, model and year is already on the site.
 * - `storage`: the image couldn't be stored (no Blob token on the server, or
 *   the store refused it).
 */
export const RACQUET_ERROR_FLAGS = [
  "invalid",
  "brand",
  "model",
  "year",
  "head-size",
  "weight",
  "balance",
  "length",
  "string-pattern",
  "source",
  "image-missing",
  "image-type",
  "image-size",
  "exists",
  "storage",
] as const;

export type RacquetErrorFlag = (typeof RACQUET_ERROR_FLAGS)[number];

/**
 * The racquet's URL slug: `brand-model-year`, e.g. `yonex-ezone-98-2022`.
 * Accents are folded (Tecnifibre "Pro Stock" stays readable), everything else
 * that isn't a letter or digit becomes one hyphen. Null when the model leaves
 * nothing to put in a URL.
 */
export function racquetSlug(brand: string, model: string, year: number): string | null {
  const part = (text: string) =>
    text
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const modelPart = part(model);
  if (!modelPart) return null;
  return `${part(brand)}-${modelPart}-${year}`;
}
