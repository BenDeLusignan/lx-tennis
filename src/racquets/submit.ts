import "server-only";
import { loginPath } from "@/auth/safe-next-path";
import { RACQUET_SLUG_MAX_LENGTH } from "@/data/limits";
import {
  BRANDS,
  createRacquet,
  racquetIdentityTaken,
  racquetImageAlt,
  racquetSlugExists,
  removeRacquet,
  saveRacquetEdit,
  type Brand,
  type RacquetSpecs,
} from "@/data/racquets";
import type { Reviewer } from "@/data/reviewers";
import { parseScaledDecimal } from "@/forms/fields";
import { getImageStore, type ImageStore } from "@/racquets/image-store";
import { toRacquetWebp } from "@/racquets/process-image";
import { fetchImageFromLink, parseImageLink, type ImageFetchResult } from "@/racquets/image-fetch";
import {
  editRacquetPath,
  IMAGE_MAX_BYTES,
  maxRacquetYear,
  NEW_RACQUET_PATH,
  parseRacquetSlug,
  RACQUET_FIELDS,
  RACQUET_LIMITS,
  RACQUETS_ADMIN_PATH,
  racquetSlug,
  type RacquetErrorFlag,
} from "@/racquets/racquet-form";

/**
 * What the racquet Server Actions (`src/racquets/actions.ts`: `addRacquet`,
 * `updateRacquet`, `deleteRacquet`) do, given the logged-in reviewer (null for
 * a visitor). Each returns the URL to redirect to, so it can be tested
 * without a Next request. Errors go in the URL as a flag
 * (`RACQUET_ERROR_FLAGS`), never what was typed.
 *
 * Adding and editing share the checks and the photo pipeline. Everything
 * that can be checked without side effects is checked first, then the photo
 * is read (an upload) or fetched (an image link; the site keeps its own copy,
 * so it can't rot), converted, stored, and the row written last: if the row
 * can't be saved the stored image is removed again, so a refusal leaves
 * neither a row change nor an orphaned file. An edit that replaced the photo
 * removes the old file only after the new row has committed, and a delete
 * removes the racquet's file after the row is gone, so a failure never costs
 * a racquet its photo. The link is never put in a URL.
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

interface ParsedFields {
  brand: Brand;
  model: string;
  name: string;
  year: number;
  slug: string;
  specs: RacquetSpecs;
}

/**
 * `mode` only matters for the slug. An add lives at the slug these fields
 * make, so a model whose slug would be too long is refused. An edit ignores
 * the slug it works out (the racquet keeps its own), so only a model with
 * nothing a URL can carry fails.
 */
function parseFields(formData: FormData, now: Date, mode: "add" | "edit"): Parsed<ParsedFields> {
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
  if (!slug || (mode === "add" && slug.length > RACQUET_SLUG_MAX_LENGTH)) return fail("model");

  const { headSize, weightGrams, balanceMm, lengthIn, stringPattern } = RACQUET_LIMITS;
  const headSizeSqIn = optionalNumber(formData, RACQUET_FIELDS.headSize, 0, headSize.min, headSize.max);
  if (headSizeSqIn === undefined) return fail("head-size");
  const grams = optionalNumber(formData, RACQUET_FIELDS.weightGrams, 0, weightGrams.min, weightGrams.max);
  if (grams === undefined) return fail("weight");
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
    balanceMm: balance,
    lengthIn: length,
    stringPattern: mains !== null && crosses !== null ? { mains, crosses } : null,
  };

  return { ok: true, value: { brand, model, name: `${brand} ${model}`, year, slug, specs } };
}

type ImageSource = { kind: "file"; file: File } | { kind: "link"; url: URL };

/**
 * Which of the two photo sources the reviewer gave: null for neither, which
 * adding refuses (`image-missing`) and an edit takes as "keep the current
 * photo". Both is `image-both`, not a guess. Nothing is read or fetched yet.
 */
function chooseImageSource(formData: FormData): Parsed<ImageSource | null> {
  const file = formData.get(RACQUET_FIELDS.image);
  const linkText = textField(formData, RACQUET_FIELDS.imageUrl);
  if (linkText === null) return fail("invalid");
  // A browser sends an empty, nameless file when none was chosen.
  if (typeof file === "string" && file !== "") return fail("invalid");
  const upload = file !== null && typeof file !== "string" && file.size > 0 ? file : null;
  const hasLink = linkText.trim() !== "";

  if (upload && hasLink) return fail("image-both");
  if (upload) {
    return upload.size > IMAGE_MAX_BYTES ? fail("image-size") : { ok: true, value: { kind: "file", file: upload } };
  }
  if (!hasLink) return { ok: true, value: null };
  const url = parseImageLink(linkText);
  return url ? { ok: true, value: { kind: "link", url } } : fail("image-link");
}

/** The chosen photo's bytes (read, or fetched from the link) as the site's 1000 x 1500 WebP. */
async function toWebp(
  source: ImageSource,
  fetchLink: (url: URL) => Promise<ImageFetchResult>,
): Promise<Parsed<Buffer>> {
  let original: Buffer;
  if (source.kind === "file") {
    original = Buffer.from(await source.file.arrayBuffer());
  } else {
    const fetched = await fetchLink(source.url);
    if (!fetched.ok) return fail(fetched.error);
    original = fetched.bytes;
  }

  // Whatever the source, only toRacquetWebp decides the bytes are a photo.
  const webp = await toRacquetWebp(original);
  return webp ? { ok: true, value: webp } : fail("image-type");
}

/** Stores the WebP, returning its `src`; a store that fails is the `storage` flag. */
async function storeImage(store: ImageStore, slug: string, webp: Buffer): Promise<Parsed<string>> {
  try {
    return { ok: true, value: await store.save(slug, webp) };
  } catch (error) {
    console.error("Saving a racquet image failed:", error);
    return fail("storage");
  }
}

/** The chosen photo as a stored WebP, returning its `src`. */
async function storePhoto(
  source: ImageSource,
  slug: string,
  store: ImageStore,
  fetchLink: (url: URL) => Promise<ImageFetchResult>,
): Promise<Parsed<string>> {
  const webp = await toWebp(source, fetchLink);
  return webp.ok ? storeImage(store, slug, webp.value) : webp;
}

const loginFor = (slug: string | null): string =>
  loginPath(slug === null ? RACQUETS_ADMIN_PATH : editRacquetPath(slug));

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
 * racquet's page. `store` is the image store and `fetchLink` gets the bytes
 * behind an image link; only tests pass their own.
 */
export async function submitRacquetAdd(
  reviewer: Reviewer | null,
  formData: FormData,
  store: ImageStore = getImageStore(),
  now: Date = new Date(),
  fetchLink: (url: URL) => Promise<ImageFetchResult> = fetchImageFromLink,
): Promise<string> {
  if (!reviewer) return loginPath(NEW_RACQUET_PATH);
  const refuse = (error: RacquetErrorFlag) => `${NEW_RACQUET_PATH}?error=${error}`;

  const fields = parseFields(formData, now, "add");
  if (!fields.ok) return refuse(fields.error);
  const { brand, name, year, slug, specs } = fields.value;

  // The photo is required: one source, checked before any work is done for it.
  const source = chooseImageSource(formData);
  if (!source.ok) return refuse(source.error);
  if (source.value === null) return refuse("image-missing");

  // Cheap duplicate check before the expensive conversion and upload, and
  // before any request goes out to another website. The insert checks again
  // inside its transaction, which is what decides a race.
  if (await racquetIdentityTaken(brand, name, year)) return refuse("exists");

  const stored = await storePhoto(source.value, slug, store, fetchLink);
  if (!stored.ok) return refuse(stored.error);
  const src = stored.value;

  try {
    const result = await createRacquet(
      { slug, brand, name, year, image: { src, alt: racquetImageAlt(name, year) }, specs },
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

/**
 * Saves an edit of the racquet named by the form's hidden `slug`: success
 * goes back to the list. Brand, model, year and specs are checked as when
 * adding; the photo is optional (neither a file nor a link keeps the current
 * one; both is refused). The slug and id never change: the slug the fields
 * would make is ignored, so links and setups keep working. The reviewer's
 * identity comes from the session; nothing in the form says who is editing.
 */
export async function submitRacquetUpdate(
  reviewer: Reviewer | null,
  formData: FormData,
  store: ImageStore = getImageStore(),
  now: Date = new Date(),
  fetchLink: (url: URL) => Promise<ImageFetchResult> = fetchImageFromLink,
): Promise<string> {
  // The one thing read first: the slug's shape, to know where to come back to.
  const slug = parseRacquetSlug(formData.get(RACQUET_FIELDS.slug));
  if (!reviewer) return loginFor(slug);
  const notFound = `${RACQUETS_ADMIN_PATH}?error=not-found`;
  // Refuses a racquet that's gone before any parsing or image work. The write
  // checks again inside its transaction, which is what decides a race.
  if (slug === null || !(await racquetSlugExists(slug))) return notFound;
  const refuse = (error: RacquetErrorFlag) => `${editRacquetPath(slug)}?error=${error}`;

  const fields = parseFields(formData, now, "edit");
  if (!fields.ok) return refuse(fields.error);
  const { brand, name, year, specs } = fields.value;

  const source = chooseImageSource(formData);
  if (!source.ok) return refuse(source.error);

  // Before the image work and any request to another website; the update
  // checks again inside its transaction, which is what decides a race.
  if (await racquetIdentityTaken(brand, name, year, slug)) return refuse("exists");

  let newImageSrc: string | null = null;
  if (source.value !== null) {
    const stored = await storePhoto(source.value, slug, store, fetchLink);
    if (!stored.ok) return refuse(stored.error);
    newImageSrc = stored.value;
  }

  try {
    const result = await saveRacquetEdit({ slug, brand, name, year, specs, newImageSrc });
    if (result.status !== "saved") {
      // Refused, so the new photo is an orphan.
      if (newImageSrc !== null) await removeQuietly(store, newImageSrc);
      return result.status === "exists" ? refuse("exists") : notFound;
    }
    // The new row is committed, so only now is the replaced photo let go.
    // The store skips anything it didn't save (the built-in racquets' files).
    if (result.replacedImageSrc !== null) await removeQuietly(store, result.replacedImageSrc);
  } catch (error) {
    if (newImageSrc !== null) await removeQuietly(store, newImageSrc);
    throw error;
  }
  return `${RACQUETS_ADMIN_PATH}?saved=${slug}`;
}

/**
 * Deletes the racquet named by the form's hidden `slug`, if no setup uses it:
 * success goes back to the list, and so does a racquet that's already gone (a
 * double-submitted Delete isn't an error). One a setup uses goes back to its
 * edit page as `in-use`, with nothing deleted. The racquet's stored photo is
 * removed after its row is gone; the built-in racquets' files never are.
 */
export async function submitRacquetDelete(
  reviewer: Reviewer | null,
  formData: FormData,
  store: ImageStore = getImageStore(),
): Promise<string> {
  const slug = parseRacquetSlug(formData.get(RACQUET_FIELDS.slug));
  if (!reviewer) return loginFor(slug);
  if (slug === null) return `${RACQUETS_ADMIN_PATH}?error=not-found`;

  const result = await removeRacquet(slug);
  if (result.status === "in-use") return `${editRacquetPath(slug)}?error=in-use`;
  if (result.status === "deleted") await removeQuietly(store, result.imageSrc);
  return `${RACQUETS_ADMIN_PATH}?deleted=1`;
}
