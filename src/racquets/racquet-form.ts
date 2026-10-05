import { RACQUET_SLUG_MAX_LENGTH } from "@/data/limits";

/**
 * The racquet forms' contract: field names, limits and the `?error=` flags,
 * for adding, editing and deleting a racquet. Pure (no `server-only`), like
 * `src/data/units.ts`, so the pages can use the same numbers for their HTML
 * checks (`min`, `max`, `step`, `maxLength`, `accept`) that the Server Actions
 * enforce.
 *
 * The ranges in `RACQUET_LIMITS` are the form's. The `racquet` table repeats
 * them as sanity checks (`src/db/schema.ts`); change them together.
 */

/** Where the add form lives, and where every refusal of it goes back to. */
export const NEW_RACQUET_PATH = "/account/racquets/new";

/** The reviewers' racquet list; where a save, a delete and an unknown racquet end up. */
export const RACQUETS_ADMIN_PATH = "/account/racquets";

/** The edit form (and, below it, the delete panel) of one racquet; where its refusals go back to. */
export function editRacquetPath(slug: string): string {
  return `${RACQUETS_ADMIN_PATH}/${slug}/edit`;
}

/**
 * A racquet's model: its name without the brand ("Yonex EZONE 98" is
 * "EZONE 98"). What the edit form prefills the model field with, and what
 * the duplicate check compares (`src/data/racquets.ts`). The table
 * guarantees a name starts with its brand and a space.
 */
export function racquetModel(racquet: { brand: string; name: string }): string {
  return racquet.name.slice(racquet.brand.length + 1);
}

/** The form's field names. The page and the Server Action both read them from here. */
export const RACQUET_FIELDS = {
  /**
   * Which racquet an edit or a delete is for: its slug, which never changes
   * after creation. The server looks the racquet up by it and never trusts
   * anything else from the request about who or what it is. (Not a field of
   * the add form: the add form's slug is worked out from brand, model and year.)
   */
  slug: "slug",
  brand: "brand",
  /** The model without the brand: "EZONE 98". The racquet's name is "Yonex EZONE 98". */
  model: "model",
  year: "year",
  headSize: "headSize",
  weightGrams: "weightGrams",
  balanceMm: "balanceMm",
  lengthIn: "lengthIn",
  stringMains: "stringMains",
  stringCrosses: "stringCrosses",
  /**
   * The photo as an upload. Adding needs exactly one of `image` and
   * `imageUrl`; editing allows neither (keep the current photo) but never both.
   */
  image: "image",
  /** The photo as an https link to an image on another website, copied by the reviewer. */
  imageUrl: "imageUrl",
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
  /** Unstrung, grams, as the manufacturer publishes it. Grams only, never ounces (Product rule 11). */
  weightGrams: { min: 150, max: 450, step: 1 },
  /** Millimetres from the butt cap. */
  balanceMm: { min: 200, max: 450, step: 1 },
  /** Inches, up to 2 decimals (27.25). */
  lengthIn: { min: 17, max: 29, step: 0.01 },
  /** Mains and crosses, each. Both or neither. */
  stringPattern: { min: 12, max: 24, step: 1 },
  /** The image link, characters as typed (after trimming). */
  imageUrl: { maxLength: 2000 },
} as const;

/** The latest model year accepted: next year, since racquets are announced ahead. */
export function maxRacquetYear(now: Date = new Date()): number {
  return now.getUTCFullYear() + 1;
}

/**
 * The image's limit is the size of the upload: Vercel refuses a function
 * request body over 4.5 MB, so the file is capped below that (the other
 * fields are a few hundred bytes). `serverActions.bodySizeLimit` in
 * `next.config.ts` sits just above this so our own message shows first. A
 * photo fetched from an image link is held to the same limit, though it
 * doesn't travel in the request: one pipeline, one rule.
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
 * Every `?error=` flag the forms can come back with. Nothing was saved or
 * deleted in any of these cases, and the page's message for each should say
 * so.
 *
 * - `invalid`: the request isn't something the form could send: a field that
 *   should be text arrived as a file, or the image field arrived as text.
 *   (A field that is simply missing counts as blank, and gets its own flag.)
 * - `brand`: missing, or not one of `BRANDS`.
 * - `model`: blank, too long, or nothing in it a URL can carry (all symbols),
 *   or so long that its slug would exceed `RACQUET_SLUG_MAX_LENGTH`.
 * - `year`: not a whole year from 1990 to next year.
 * - `head-size`, `weight` (grams), `balance`, `length`:
 *   not a number, too many decimals, or out of range.
 * - `string-pattern`: only one of mains and crosses given, or out of range.
 * - `image-missing`: adding only: neither a file nor an image link was given.
 *   (An edit with neither keeps the current photo.)
 * - `image-both`: both a file and an image link were given. The server
 *   doesn't guess which one is meant; the reviewer gives one.
 * - `image-link`: the link isn't something to fetch: not a web address, not
 *   https, has a user name or password in it, or is longer than
 *   `RACQUET_LIMITS.imageUrl.maxLength`.
 * - `image-fetch`: the site couldn't get an image from the link. One flag for
 *   every cause (the host doesn't exist, it points somewhere the site won't
 *   connect to, too many redirects, a timeout, an error status, an empty
 *   answer), so the form can't be used to probe the network behind the
 *   server. Nothing in the URL or the message says which.
 * - `image-type`: the file, or what the link served, is not a readable JPEG,
 *   PNG, WebP, GIF or AVIF, or is readable but has nothing usable in it: blank,
 *   one flat colour, fully transparent, or trimmed down to a speck or a thin
 *   line (`toRacquetWebp` in `process-image.ts`).
 * - `image-size`: over `IMAGE_MAX_BYTES` (the uploaded file, or what the link served).
 * - `exists`: another racquet already has this brand, model and year (a
 *   racquet's name and year, compared as its slug is: ignoring capitals and
 *   punctuation). On an edit it means the change would make two racquets
 *   look the same; the edited racquet itself never counts.
 * - `storage`: the image couldn't be stored (no Blob token on the server, or
 *   the store refused it).
 * - `in-use`: a delete was refused because a setup uses the racquet. Comes
 *   back to the edit page, which shows the reason.
 * - `not-found`: an edit or a delete named a racquet that doesn't exist (a
 *   malformed slug, or one deleted meanwhile). Comes back to the list, since
 *   there's no edit page to return to.
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
  "image-missing",
  "image-both",
  "image-link",
  "image-fetch",
  "image-type",
  "image-size",
  "exists",
  "storage",
  "in-use",
  "not-found",
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

/** The slug's shape: what `racquetSlug` makes, at most `RACQUET_SLUG_MAX_LENGTH`. Null if it can't be one. */
export function parseRacquetSlug(value: unknown): string | null {
  return typeof value === "string" && value.length <= RACQUET_SLUG_MAX_LENGTH && /^[a-z0-9-]+$/.test(value)
    ? value
    : null;
}
