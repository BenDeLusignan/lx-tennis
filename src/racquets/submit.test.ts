// Must be first: it sets up the test database and stands in for next/cache (see the file).
import { clearRefreshedTags, refreshedTags } from "@/data/test-database";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { RACQUET_SLUG_MAX_LENGTH } from "@/data/limits";
import { getRacquet, getRacquetSlugs, getRacquetsByBrand, createRacquet, IMAGE_SIZE } from "@/data/racquets";
import type { Reviewer } from "@/data/reviewers";
import { getDb } from "@/db/client";
import { racquet } from "@/db/schema";
import type { ImageStore } from "@/racquets/image-store";
import type { ImageFetchResult } from "@/racquets/image-fetch";
import { parseRacquetSlug } from "@/reviews/setup-form";
import { toRacquetWebp } from "@/racquets/process-image";
import { IMAGE_MAX_BYTES, RACQUET_ERROR_FLAGS, racquetSlug } from "@/racquets/racquet-form";
import { submitAddRacquet } from "@/racquets/submit";

const BEN: Reviewer = { id: 1, username: "ben", displayName: "Ben" };
const FORM_PATH = "/account/racquets/new";

// Tests share one database, so "nothing saved" is measured against the rows at the start of each.
let rowsAtStart = 0;

beforeEach(async () => {
  clearRefreshedTags();
  store.reset();
  fetched.length = 0;
  linkResult = { ok: false, error: "image-fetch" };
  rowsAtStart = await rowCount();
});

/** An in-memory image store that records what was saved and removed. */
class FakeStore implements ImageStore {
  saved = new Map<string, Buffer>();
  removed: string[] = [];
  failSave = false;
  /** Runs after the image is stored, before the row is inserted: where a race can happen. */
  afterSave: (slug: string) => Promise<void> = async () => {};

  reset(): void {
    this.saved.clear();
    this.removed = [];
    this.failSave = false;
    this.afterSave = async () => {};
  }

  async save(slug: string, webp: Buffer): Promise<string> {
    if (this.failSave) throw new Error("the store is down");
    const src = `https://fake.public.blob.vercel-storage.com/racquets/${slug}-${this.saved.size}.webp`;
    this.saved.set(src, webp);
    await this.afterSave(slug);
    return src;
  }

  async remove(src: string): Promise<void> {
    this.removed.push(src);
    this.saved.delete(src);
  }
}

const store = new FakeStore();

const fetched: URL[] = [];
let linkResult: ImageFetchResult = { ok: false, error: "image-fetch" };
async function fakeFetch(url: URL): Promise<ImageFetchResult> {
  fetched.push(url);
  return linkResult;
}

/** A real image: a solid colour of the given size and format. */
async function image(
  width = 600,
  height = 400,
  format: "png" | "jpeg" | "webp" | "gif" | "avif" = "png",
): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 255, g: 0, b: 128 } } })
    [format]()
    .toBuffer();
}

async function form(fields: Record<string, string> = {}, file?: Buffer | null): Promise<FormData> {
  const formData = new FormData();
  const all: Record<string, string> = { brand: "Head", model: "Speed MP", year: "2024", ...fields };
  for (const [name, value] of Object.entries(all)) formData.set(name, value);
  if (file !== null) {
    formData.set("image", new File([new Uint8Array(file ?? (await image()))], "racquet.png", { type: "image/png" }));
  }
  return formData;
}

/** The upload path: `fakeFetch` records any link fetch and answers with `linkResult`, so no test reaches the network. */
async function submit(fields: Record<string, string> = {}, file?: Buffer | null): Promise<string> {
  return submitAddRacquet(BEN, await form(fields, file), store, undefined, fakeFetch);
}

async function rowCount(): Promise<number> {
  return (await getDb().select({ id: racquet.id }).from(racquet)).length;
}

/** Nothing saved: no new row, no stored image, no refresh. */
async function assertNothingSaved(): Promise<void> {
  assert.equal(await rowCount(), rowsAtStart);
  assert.equal(store.saved.size, 0);
  assert.deepEqual(store.removed, []);
  assert.deepEqual(refreshedTags, []);
}

const refused = (flag: string) => `${FORM_PATH}?error=${flag}`;

test("a visitor is sent to log in and nothing is saved", async () => {
  assert.equal(
    await submitAddRacquet(null, await form(), store),
    `/login?next=${encodeURIComponent(FORM_PATH)}`,
  );
  await assertNothingSaved();
});

test("a reviewer adds a racquet: row saved, 1000x1500 WebP stored, lists refreshed, sent to its page", async () => {
  const url = await submit(
    {
      model: "Speed MP",
      headSize: "100",
      weightGrams: "300",
      balanceMm: "320",
      lengthIn: "27.25",
      stringMains: "16",
      stringCrosses: "19",
    },
    await image(600, 400, "jpeg"),
  );
  assert.equal(url, "/racquets/head-speed-mp-2024");
  assert.equal(fetched.length, 0, "an upload fetches nothing");

  const found = await getRacquet("head-speed-mp-2024");
  assert.ok(found);
  assert.equal(found.brand, "Head");
  assert.equal(found.name, "Head Speed MP");
  assert.equal(found.year, 2024);
  assert.equal(found.generation, null);
  assert.deepEqual(found.specs, {
    headSizeSqIn: 100,
    weightGrams: 300,
    balanceMm: 320,
    lengthIn: 27.25,
    stringPattern: { mains: 16, crosses: 19 },
  });
  assert.equal(found.image.width, IMAGE_SIZE.width);
  assert.equal(found.image.height, IMAGE_SIZE.height);
  assert.equal(found.image.alt, "Head Speed MP (2024) racquet");

  // Who added it is kept.
  const [row] = await getDb().select({ createdBy: racquet.createdBy }).from(racquet).where(eq(racquet.slug, found.slug));
  assert.equal(row.createdBy, BEN.id);

  // The stored file is the one the row points at: a 1000x1500 WebP, the photo
  // fitted at the top of a transparent canvas (600x400 scales to 1000x667).
  assert.equal([...store.saved.keys()].length, 1);
  const webp = store.saved.get(found.image.src);
  assert.ok(webp);
  const meta = await sharp(webp).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ["webp", 1000, 1500]);
  const { data, info } = await sharp(webp).raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];
  assert.equal(alphaAt(500, 10), 255);
  assert.equal(alphaAt(500, 600), 255);
  assert.equal(alphaAt(500, 1400), 0);

  // The brand section, the racquet page and generateStaticParams all see it.
  const head = (await getRacquetsByBrand()).find((section) => section.brand === "Head");
  assert.deepEqual(head?.racquets.map((entry) => entry.slug), ["head-speed-mp-2024"]);
  assert.ok((await getRacquetSlugs()).includes("head-speed-mp-2024"));
  assert.deepEqual(refreshedTags.sort(), ["racquets", "setups:head-speed-mp-2024"]);
});

test("every spec is optional: a racquet with none is saved", async () => {
  const url = await submit({ model: "No Specs", year: "2025" });
  assert.equal(url, "/racquets/head-no-specs-2025");
  const found = await getRacquet("head-no-specs-2025");
  assert.deepEqual(found?.specs, {
    headSizeSqIn: null,
    weightGrams: null,
    balanceMm: null,
    lengthIn: null,
    stringPattern: null,
  });
});

test("a spec left blank stays out while the others are kept", async () => {
  await submit({ model: "Partial", headSize: "98", weightGrams: "" });
  const specs = (await getRacquet("head-partial-2024"))?.specs;
  assert.equal(specs?.headSizeSqIn, 98);
  assert.equal(specs?.weightGrams, null);
  assert.equal(specs?.stringPattern, null);
});

test("a missing image is refused and nothing is saved", async () => {
  assert.equal(await submit({}, null), refused("image-missing"));
  // A browser with no file chosen sends an empty, nameless file.
  const formData = await form({}, null);
  formData.set("image", new File([], ""));
  assert.equal(await submitAddRacquet(BEN, formData, store, undefined, fakeFetch), refused("image-missing"));
  // Not a file at all (a hand-made request): invalid, not missing.
  formData.set("image", "not a file");
  assert.equal(await submitAddRacquet(BEN, formData, store, undefined, fakeFetch), refused("invalid"));
  const linkAsFile = await form({}, null);
  linkAsFile.set("imageUrl", new File(["https://x.com/a.png"], "link.txt"));
  assert.equal(await submitAddRacquet(BEN, linkAsFile, store, undefined, fakeFetch), refused("invalid"));
  await assertNothingSaved();
});

test("a file that isn't a readable image is refused and nothing is saved", async () => {
  assert.equal(await submit({ model: "Text" }, Buffer.from("this is not a picture")), refused("image-type"));
  // A truncated PNG is not usable either.
  assert.equal(await submit({ model: "Cut" }, (await image()).subarray(0, 40)), refused("image-type"));
  // SVG is code, not a photo.
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
  assert.equal(await submit({ model: "Svg" }, svg), refused("image-type"));
  await assertNothingSaved();
});

test("an image over the size limit is refused and nothing is saved", async () => {
  assert.equal(await submit({}, Buffer.alloc(IMAGE_MAX_BYTES + 1)), refused("image-size"));
  await assertNothingSaved();
});

// --- The photo as an image link ---

const LINK = "https://images.example.com/racquets/speed-mp.png";

test("an image link is fetched, stored as the site's own 1000x1500 WebP, and the racquet is saved", async () => {
  linkResult = { ok: true, bytes: await image(600, 400, "jpeg") };
  const url = await submit({ model: "Linked", imageUrl: `  ${LINK}  ` }, null);
  assert.equal(url, "/racquets/head-linked-2024");
  assert.deepEqual(fetched.map((link) => link.href), [LINK]);

  const found = await getRacquet("head-linked-2024");
  assert.ok(found);
  // The row holds the site's own copy, never the other site's address.
  assert.ok(found.image.src.startsWith("https://fake.public.blob.vercel-storage.com/"));
  const webp = store.saved.get(found.image.src);
  assert.ok(webp);
  const meta = await sharp(webp).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ["webp", 1000, 1500]);
  assert.deepEqual(refreshedTags.sort(), ["racquets", "setups:head-linked-2024"]);
});

test("exactly one photo source: a file and a link together are refused, not guessed", async () => {
  linkResult = { ok: true, bytes: await image() };
  assert.equal(await submit({ model: "Both", imageUrl: LINK }), refused("image-both"));
  // Even when the link is nonsense, the request is ambiguous first.
  assert.equal(await submit({ model: "Both", imageUrl: "nonsense" }), refused("image-both"));
  assert.equal(fetched.length, 0, "nothing was fetched");
  await assertNothingSaved();
  // Neither is still image-missing; a blank link counts as none.
  assert.equal(await submit({ model: "Neither", imageUrl: "   " }, null), refused("image-missing"));
  // An empty, nameless file (no file chosen) beside a link is just the link.
  const formData = await form({ model: "Empty file", imageUrl: LINK }, null);
  formData.set("image", new File([], ""));
  assert.equal(await submitAddRacquet(BEN, formData, store, undefined, fakeFetch), "/racquets/head-empty-file-2024");
});

test("a link that isn't a plain https address is refused before anything is fetched", async () => {
  linkResult = { ok: true, bytes: await image() };
  for (const bad of [
    "http://images.example.com/a.png",
    "images.example.com/a.png",
    "//images.example.com/a.png",
    "ftp://images.example.com/a.png",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "file:///etc/passwd",
    "https://",
    "https://user:pass@images.example.com/a.png",
    "https://user@images.example.com/a.png",
    "https://images.example.com:8443/a.png",
    "https://images.example.com/a b.png",
    `https://images.example.com/${"a".repeat(2000)}`,
  ]) {
    assert.equal(await submit({ imageUrl: bad }, null), refused("image-link"), bad);
  }
  assert.equal(fetched.length, 0);
  await assertNothingSaved();
});

test("a link that can't be fetched, is too big or isn't an image is refused and nothing is saved", async () => {
  linkResult = { ok: false, error: "image-fetch" };
  assert.equal(await submit({ model: "Down", imageUrl: LINK }, null), refused("image-fetch"));
  linkResult = { ok: false, error: "image-size" };
  assert.equal(await submit({ model: "Huge", imageUrl: LINK }, null), refused("image-size"));
  // Served 200 OK, but the bytes aren't a photo: the same sharp check as an upload.
  linkResult = { ok: true, bytes: Buffer.from("<html><body>Not an image</body></html>") };
  assert.equal(await submit({ model: "Page", imageUrl: LINK }, null), refused("image-type"));
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
  linkResult = { ok: true, bytes: svg };
  assert.equal(await submit({ model: "Svg", imageUrl: LINK }, null), refused("image-type"));
  await assertNothingSaved();
});

test("a duplicate is refused before the link is fetched", async () => {
  linkResult = { ok: true, bytes: await image() };
  assert.equal(await submit({ brand: "Yonex", model: "EZONE 98", year: "2022", imageUrl: LINK }, null), refused("exists"));
  assert.equal(fetched.length, 0);
  await assertNothingSaved();
});

test("the link is never put in the redirect URL", async () => {
  const secret = "https://images.example.com/private-token-123/a.png";
  linkResult = { ok: false, error: "image-fetch" };
  assert.equal(await submit({ model: "Secret A", imageUrl: secret }, null), refused("image-fetch"));
  assert.equal(await submit({ imageUrl: `${secret} x` }, null), refused("image-link"));
  linkResult = { ok: true, bytes: await image() };
  assert.ok(!(await submit({ model: "Secret", imageUrl: secret }, null)).includes("token"));
});

test("a brand that isn't on the list is refused and nothing is saved", async () => {
  assert.equal(await submit({ brand: "Prince" }), refused("brand"));
  assert.equal(await submit({ brand: "head" }), refused("brand"));
  assert.equal(await submit({ brand: "" }), refused("brand"));
  // Not text at all (a hand-made request).
  const formData = await form();
  formData.set("brand", new File(["Head"], "brand.txt"));
  assert.equal(await submitAddRacquet(BEN, formData, store), refused("invalid"));
  await assertNothingSaved();
});

test("model and year are checked", async () => {
  assert.equal(await submit({ model: "   " }), refused("model"));
  assert.equal(await submit({ model: "x".repeat(61) }), refused("model"));
  assert.equal(await submit({ model: "***" }), refused("model"));
  assert.equal(await submit({ year: "" }), refused("year"));
  assert.equal(await submit({ year: "1989" }), refused("year"));
  assert.equal(await submit({ year: "2024.5" }), refused("year"));
  assert.equal(await submit({ year: "abc" }), refused("year"));
  await assertNothingSaved();
});

test("the latest year is next year", async () => {
  const next = new Date().getUTCFullYear() + 1;
  assert.equal(await submit({ model: "Future", year: String(next + 1) }), refused("year"));
  assert.equal(await submit({ model: "Future", year: String(next) }), `/racquets/head-future-${next}`);
});

test("a slug longer than the 'Add a setup' form accepts is refused", async () => {
  // "ﬃ" folds to three letters, so a 60-character model can make a long slug.
  const slugOf = (ligatures: number) => `head-${"ffi".repeat(ligatures)}-2024`;
  assert.equal(slugOf(30).length, RACQUET_SLUG_MAX_LENGTH);
  assert.equal(await submit({ model: "ﬃ".repeat(31), year: "2024" }), refused("model"));
  await assertNothingSaved();
  assert.equal(await submit({ model: "ﬃ".repeat(30), year: "2024" }), `/racquets/${slugOf(30)}`);
  assert.equal(parseRacquetSlug(slugOf(30)), slugOf(30));
});

test("the slug is brand-model-year, and the brand typed into the model isn't doubled", async () => {
  assert.equal(racquetSlug("Yonex", "EZONE 98", 2022), "yonex-ezone-98-2022");
  assert.equal(racquetSlug("Tecnifibre", "Éclat Ré 305", 2024), "tecnifibre-eclat-re-305-2024");
  assert.equal(racquetSlug("Head", "!!!", 2024), null);
  assert.equal(await submit({ model: "  HEAD   Gravity  Pro ", year: "2023" }), "/racquets/head-gravity-pro-2023");
  assert.equal((await getRacquet("head-gravity-pro-2023"))?.name, "Head Gravity Pro");
});

test("a duplicate is refused before the image is stored, and the original is untouched", async () => {
  await submit({ model: "Dup", year: "2022", headSize: "98" });
  const before = store.saved.size;
  clearRefreshedTags();

  assert.equal(await submit({ model: "dup", year: "2022", headSize: "100" }), refused("exists"));
  assert.equal(await submit({ model: "  DUP!! ", year: "2022" }), refused("exists"));
  // Also a built-in racquet.
  assert.equal(await submit({ brand: "Yonex", model: "EZONE 98", year: "2022" }), refused("exists"));
  assert.equal(store.saved.size, before);
  assert.deepEqual(store.removed, []);
  assert.deepEqual(refreshedTags, []);
  assert.equal((await getRacquet("head-dup-2022"))?.specs.headSizeSqIn, 98);
});

test("two reviewers adding the same racquet at once: one wins and the loser's image is removed", async () => {
  // The other request's row lands while this one is storing its image, after
  // the cheap duplicate check has passed.
  store.afterSave = async (slug) => {
    await createRacquet(
      {
        slug,
        brand: "Head",
        name: "Head Race",
        year: 2024,
        image: { src: "/other.webp", alt: "other" },
        specs: { headSizeSqIn: null, weightGrams: null, balanceMm: null, lengthIn: null, stringPattern: null },
      },
      { id: 2, username: "michal", displayName: "Michal" },
    );
  };
  assert.equal(await submit({ model: "Race" }), refused("exists"));
  assert.equal(store.saved.size, 0, "the loser's image is removed");
  assert.equal(store.removed.length, 1);
  assert.equal((await getRacquet("head-race-2024"))?.image.src, "/other.webp");
  assert.equal(await rowCount(), rowsAtStart + 1);
});

test("when the image can't be stored nothing is saved", async () => {
  store.failSave = true;
  const error = console.error;
  console.error = () => {};
  try {
    assert.equal(await submit({ model: "Storage" }), refused("storage"));
  } finally {
    console.error = error;
  }
  await assertNothingSaved();
});

test("a racquet's specs must be in range, whole or to the allowed decimals", async () => {
  const cases: [field: string, flag: string, good: string[], bad: string[]][] = [
    ["headSize", "head-size", ["70", "140"], ["69", "141", "98.5", "abc", "-98"]],
    ["weightGrams", "weight", ["150", "450"], ["149", "451", "305.5"]],
    ["balanceMm", "balance", ["200", "450"], ["199", "451", "315.5"]],
    ["lengthIn", "length", ["17", "29", "27.25"], ["16.99", "29.01", "27.255"]],
  ];
  let n = 0;
  for (const [field, flag, good, bad] of cases) {
    for (const value of bad) {
      assert.equal(await submit({ [field]: value }), refused(flag), `${field}=${value}`);
    }
    for (const value of good) {
      const model = `Range ${n++}`;
      const url = await submit({ model, [field]: value });
      assert.equal(url, `/racquets/head-range-${n - 1}-2024`, `${field}=${value}`);
    }
  }
  assert.equal(store.removed.length, 0);
});

test("a string pattern needs both numbers, each in range", async () => {
  assert.equal(await submit({ stringMains: "16" }), refused("string-pattern"));
  assert.equal(await submit({ stringCrosses: "19" }), refused("string-pattern"));
  assert.equal(await submit({ stringMains: "11", stringCrosses: "19" }), refused("string-pattern"));
  assert.equal(await submit({ stringMains: "16", stringCrosses: "25" }), refused("string-pattern"));
  assert.equal(await submit({ stringMains: "16.5", stringCrosses: "19" }), refused("string-pattern"));
  assert.equal(await submit({ model: "Pattern", stringMains: "18", stringCrosses: "20" }), "/racquets/head-pattern-2024");
});

test("unstrung weight is grams only: an ounces field is ignored, never stored or converted", async () => {
  assert.equal(
    await submit({ model: "Grams", weightGrams: "300", weightOunces: "10.5821" }),
    "/racquets/head-grams-2024",
  );
  assert.equal((await getRacquet("head-grams-2024"))?.specs.weightGrams, 300);
  const [row] = await getDb().select().from(racquet).where(eq(racquet.slug, "head-grams-2024"));
  assert.ok(!("weightOunces" in row));
});

test("a source link is not asked for, kept or required: specs alone are enough", async () => {
  assert.equal(await submit({ model: "No Source", headSize: "100", stringMains: "16", stringCrosses: "19" }), "/racquets/head-no-source-2024");
  // A leftover sourceUrl field from an old form is simply ignored.
  assert.equal(await submit({ model: "Old Form", headSize: "100", sourceUrl: "not even a link" }), "/racquets/head-old-form-2024");
  const [row] = await getDb().select().from(racquet).where(eq(racquet.slug, "head-old-form-2024"));
  assert.ok(!("sourceUrl" in row));
});

test("every error flag the action can return is in RACQUET_ERROR_FLAGS", async () => {
  const seen = new Set<string>();
  const attempts: [Record<string, string>, (Buffer | null)?][] = [
    [{ brand: "x" }],
    [{ model: "" }],
    [{ year: "1" }],
    [{ headSize: "1" }],
    [{ weightGrams: "1" }],
    [{ balanceMm: "1" }],
    [{ lengthIn: "1" }],
    [{ stringMains: "1" }],
    [{}, null],
    [{ imageUrl: LINK }],
    [{ imageUrl: "http://example.com/a.png" }, null],
    [{ model: "Fetch fails", imageUrl: LINK }, null],
    [{ model: "Bad image" }, Buffer.from("no")],
    [{ model: "Big image" }, Buffer.alloc(IMAGE_MAX_BYTES + 1)],
    [{ brand: "Yonex", model: "EZONE 98", year: "2022" }],
  ];
  for (const [fields, file] of attempts) {
    const url = await submit(fields, file);
    seen.add(url.slice(url.indexOf("=") + 1));
  }
  for (const flag of seen) assert.ok((RACQUET_ERROR_FLAGS as readonly string[]).includes(flag), flag);
  assert.deepEqual(
    [...seen].sort(),
    ["brand", "model", "year", "head-size", "weight", "balance", "length", "string-pattern", "image-missing", "image-both", "image-link", "image-fetch", "image-type", "image-size", "exists"].sort(),
  );
});

test("photos are scaled to fit the canvas, upright, with no metadata, in any accepted format", async () => {
  // AVIF is read by sharp as format "heif", so it needs its own check.
  for (const format of ["png", "jpeg", "webp", "gif", "avif"] as const) {
    const out = await toRacquetWebp(await image(300, 900, format));
    assert.ok(out, format);
    const meta = await sharp(out).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ["webp", 1000, 1500], format);
  }
  // Taller than the canvas: scaled down to fit, centred horizontally. 2000x6000 → 500x1500.
  const tall = await toRacquetWebp(await image(2000, 6000));
  assert.ok(tall);
  const { data, info } = await sharp(tall).raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];
  assert.equal(alphaAt(100, 700), 0);
  assert.equal(alphaAt(500, 700), 255);
  assert.equal(alphaAt(900, 700), 0);

  // EXIF orientation 6 (rotate 90° clockwise): a 600x400 file is shown as 400x600.
  const rotated = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#fff" } })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const upright = await toRacquetWebp(rotated);
  assert.ok(upright);
  const { data: rotatedPixels, info: rotatedInfo } = await sharp(upright).raw().toBuffer({ resolveWithObject: true });
  // Portrait 400x600 fits at 1000x1500, filling the canvas.
  assert.equal(rotatedPixels[(1400 * rotatedInfo.width + 500) * rotatedInfo.channels + 3], 255);
  assert.equal((await sharp(upright).metadata()).exif, undefined);
});
