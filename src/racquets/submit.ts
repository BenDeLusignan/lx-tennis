import "server-only";
import { loginPath } from "@/auth/safe-next-path";
import { RACQUET_SLUG_MAX_LENGTH } from "@/data/limits";
import { BRANDS, createRacquet, racquetSlugExists, type Brand, type RacquetSpecs } from "@/data/racquets";
import type { Reviewer } from "@/data/reviewers";
import { parseScaledDecimal } from "@/forms/fields";
import { getImageStore, type ImageStore } from "@/racquets/image-store";
import { toRacquetWebp } from "@/racquets/process-image";
import {
  IMAGE_MAX_BYTES,
  maxRacquetYear,
  NEW_RACQUET_PATH,
  RACQUET_FIELDS,
  RACQUET_LIMITS,
  racquetSlug,
  type RacquetErrorFlag,
} from "@/racquets/racquet-form";

/**
 * What the `addRacquet` Server Action (`src/racquets/actions.ts`) does, given
 * the logged-in reviewer (null for a visitor). It returns the URL to redirect
 * to, so it can be tested without a Next request. Errors go in the URL as a
 * flag (`RACQUET_ERROR_FLAGS`), never what was typed.
 *
 * Everything that can be checked without side effects is checked first, then
 * the image is converted, stored, and the row inserted last: if the row can't
 * be saved the stored image is removed again, so a refusal leaves neither a
 * row nor an orphaned file.
 */

type Parsed<T> = { ok: true; value: T } | { ok: false; error: RacquetErrorFlag };

const fail = (error: RacquetErrorFlag): { ok: false; error: RacquetErrorFlag } => ({ ok: false, error });

/** The field's text ("" when it's missing), or null when it isn't text (a file). */
function textField(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (value === null) return "";
  return typeof value === "string" ? value : null;
}

/**
 * An optional number typed to `places` decimals within `min`..`max`: blank is
 * `null` (a spec the reviewer doesn't have is left out, never guessed).
 * `undefined` means a bad value.
 */
function optionalNumber(
  formData: FormData,
  name: string,
  places: number,
  min: number,
  max: number,
): number | null | undefined {
  const text = textField(formData, name);
  if (text === null) return undefined;
  if (text.trim() === "") return null;
  const scaled = parseScaledDecimal(text, places);
  if (scaled === null || scaled === "too-precise") return undefined;
  const value = scaled / 10 ** places;
  return value >= min && value <= max ? value : undefined;
}

/** An https link to a public host: what a manufacturer's page (or its archive copy) looks like. */
function parseSourceUrl(text: string): string | null {
  if (text.length > RACQUET_LIMITS.sourceUrl.maxLength || /\s/.test(text)) return null;
  try {
    const url = new URL(text);
    const ok = url.protocol === "https:" && url.hostname.includes(".") && !url.username && !url.password;
    return ok ? text : null;
  } catch {
    return null;
  }
}

interface ParsedFields {
  brand: Brand;
  model: string;
  name: string;
  year: number;
  slug: string;
  specs: RacquetSpecs;
  sourceUrl: string | null;
}

function parseFields(formData: FormData, now: Date): Parsed<ParsedFields> {
  const brandText = textField(formData, RACQUET_FIELDS.brand);
  const modelText = textField(formData, RACQUET_FIELDS.model);
  const yearText = textField(formData, RACQUET_FIELDS.year);
  if (brandText === null || modelText === null || yearText === null) return fail("invalid");

  const brand = BRANDS.find((option) => option === brandText);
  if (!brand) return fail("brand");

  // One space between words, and "Yonex EZONE 98" typed into the model box
  // doesn't become "Yonex Yonex EZONE 98".
  let model = modelText.replace(/\s+/g, " ").trim();
  if (model.toLowerCase().startsWith(`${brand.toLowerCase()} `)) model = model.slice(brand.length + 1).trim();
  if (!model || model.length > RACQUET_LIMITS.model.maxLength || /[\u0000-\u001f\u007f]/.test(model)) {
    return fail("model");
  }

  const year = parseScaledDecimal(yearText, 0);
  if (typeof year !== "number" || year < RACQUET_LIMITS.year.min || year > maxRacquetYear(now)) {
    return fail("year");
  }

  // Model is capped, but folding can lengthen a slug (a ligature becomes
  // letters), and a slug over the cap is one "Add a setup" refuses.
  const slug = racquetSlug(brand, model, year);
  if (!slug || slug.length > RACQUET_SLUG_MAX_LENGTH) return fail("model");

  const { headSize, weightGrams, weightOunces, balanceMm, lengthIn, stringPattern } = RACQUET_LIMITS;
  const headSizeSqIn = optionalNumber(formData, RACQUET_FIELDS.headSize, 0, headSize.min, headSize.max);
  if (headSizeSqIn === undefined) return fail("head-size");
  const grams = optionalNumber(formData, RACQUET_FIELDS.weightGrams, 0, weightGrams.min, weightGrams.max);
  const ounces = optionalNumber(formData, RACQUET_FIELDS.weightOunces, 4, weightOunces.min, weightOunces.max);
  if (grams === undefined || ounces === undefined) return fail("weight");
  const balance = optionalNumber(formData, RACQUET_FIELDS.balanceMm, 0, balanceMm.min, balanceMm.max);
  if (balance === undefined) return fail("balance");
  const length = optionalNumber(formData, RACQUET_FIELDS.lengthIn, 2, lengthIn.min, lengthIn.max);
  if (length === undefined) return fail("length");

  const mains = optionalNumber(formData, RACQUET_FIELDS.stringMains, 0, stringPattern.min, stringPattern.max);
  const crosses = optionalNumber(formData, RACQUET_FIELDS.stringCrosses, 0, stringPattern.min, stringPattern.max);
  // A pattern is "16 × 19": both or neither.
  if (mains === undefined || crosses === undefined || (mains === null) !== (crosses === null)) {
    return fail("string-pattern");
  }

  const specs: RacquetSpecs = {
    headSizeSqIn,
    weightGrams: grams,
    weightOunces: ounces,
    balanceMm: balance,
    lengthIn: length,
    stringPattern: mains !== null && crosses !== null ? { mains, crosses } : null,
  };

  // Product rule 10: specs only from an official source, so the link comes with them.
  const sourceText = textField(formData, RACQUET_FIELDS.sourceUrl);
  if (sourceText === null) return fail("invalid");
  const trimmedSource = sourceText.trim();
  const sourceUrl = trimmedSource === "" ? null : parseSourceUrl(trimmedSource);
  if (trimmedSource !== "" && !sourceUrl) return fail("source");
  const hasSpecs = Object.values(specs).some((spec) => spec !== null);
  if (hasSpecs && !sourceUrl) return fail("source");

  return { ok: true, value: { brand, model, name: `${brand} ${model}`, year, slug, specs, sourceUrl } };
}

/** The uploaded file's bytes, or the flag for why there are none. */
async function readImage(formData: FormData): Promise<Parsed<Buffer>> {
  const file = formData.get(RACQUET_FIELDS.image);
  // A browser sends an empty, nameless file when none was chosen.
  if (file === null) return fail("image-missing");
  if (typeof file === "string") return fail(file === "" ? "image-missing" : "invalid");
  if (file.size === 0) return fail("image-missing");
  if (file.size > IMAGE_MAX_BYTES) return fail("image-size");
  return { ok: true, value: Buffer.from(await file.arrayBuffer()) };
}

/** Cleanup must never hide the real outcome, so a failed removal is logged, not thrown. */
async function removeQuietly(store: ImageStore, src: string): Promise<void> {
  try {
    await store.remove(src);
  } catch (error) {
    console.error("Removing an unused racquet image failed:", src, error);
  }
}

/**
 * Adds a racquet for the logged-in reviewer: success goes to the new
 * racquet's page. `store` is the image store; only tests pass their own.
 */
export async function submitAddRacquet(
  reviewer: Reviewer | null,
  formData: FormData,
  store: ImageStore = getImageStore(),
  now: Date = new Date(),
): Promise<string> {
  if (!reviewer) return loginPath(NEW_RACQUET_PATH);
  const refuse = (error: RacquetErrorFlag) => `${NEW_RACQUET_PATH}?error=${error}`;

  const fields = parseFields(formData, now);
  if (!fields.ok) return refuse(fields.error);
  const { brand, name, year, slug, specs, sourceUrl } = fields.value;

  // The image is required, and checked before any work is done for it.
  const upload = await readImage(formData);
  if (!upload.ok) return refuse(upload.error);

  // Cheap duplicate check before the expensive conversion and upload. The
  // insert checks again inside its transaction, which is what decides a race.
  if (await racquetSlugExists(slug)) return refuse("exists");

  const webp = await toRacquetWebp(upload.value);
  if (!webp) return refuse("image-type");

  let src: string;
  try {
    src = await store.save(slug, webp);
  } catch (error) {
    console.error("Saving a racquet image failed:", error);
    return refuse("storage");
  }

  try {
    const result = await createRacquet(
      { slug, brand, name, year, image: { src, alt: `${name} (${year}) racquet` }, specs, sourceUrl },
      reviewer,
    );
    if (result.status === "exists") {
      await removeQuietly(store, src);
      return refuse("exists");
    }
  } catch (error) {
    // The row didn't land, so the image must not be left behind.
    await removeQuietly(store, src);
    throw error;
  }
  return `/racquets/${slug}`;
}
