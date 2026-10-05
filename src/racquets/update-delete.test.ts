// Must be first: it sets up the test database and stands in for next/cache (see the file).
import { clearRefreshedTags, refreshedTags } from "@/data/test-database";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { eq, sql } from "drizzle-orm";
import { getRacquet, getRacquetSlugs, getRacquetsByBrandWithUsage } from "@/data/racquets";
import type { Reviewer } from "@/data/reviewers";
import { getRacquetSetups } from "@/data/setups";
import { getDb } from "@/db/client";
import { racquet } from "@/db/schema";
import type { ImageFetchResult } from "@/racquets/image-fetch";
import { FakeImageStore, racquetImage as image } from "@/racquets/racquet-fixtures";
import { IMAGE_MAX_BYTES, racquetModel, racquetSlug } from "@/racquets/racquet-form";
import { submitRacquetAdd, submitRacquetDelete, submitRacquetUpdate } from "@/racquets/submit";
import { submitDeleteReview, submitSetupWithReview } from "@/reviews/submit";

// Seeded on a fresh database: reviewers 1–3, racquets 1–4 (no setups), strings 1–10.
const BEN: Reviewer = { id: 1, username: "ben", displayName: "Ben" };
const LIST = "/account/racquets";
const editPath = (slug: string) => `${LIST}/${slug}/edit`;
const refused = (slug: string, flag: string) => `${editPath(slug)}?error=${flag}`;
const NOT_FOUND = `${LIST}?error=not-found`;

const store = new FakeImageStore();
const fetched: URL[] = [];
let linkResult: ImageFetchResult = { ok: false, error: "image-fetch" };
async function fakeFetch(url: URL): Promise<ImageFetchResult> {
  fetched.push(url);
  return linkResult;
}

beforeEach(() => {
  clearRefreshedTags();
  store.reset();
  fetched.length = 0;
  linkResult = { ok: false, error: "image-fetch" };
});

let counter = 0;
/** A model nobody else uses, so tests share one database without meeting each other's racquets. */
function uniqueModel(label: string): string {
  return `${label} ${(counter++).toString(36)}`;
}

function formData(fields: Record<string, string>, file?: Buffer | null): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  if (file) data.set("image", new File([new Uint8Array(file)], "racquet.png", { type: "image/png" }));
  return data;
}

/** Adds a Head racquet through the real add flow, returning its slug. */
async function add(label: string, extra: Record<string, string> = {}, year = "2024"): Promise<string> {
  const model = uniqueModel(label);
  const slug = racquetSlug("Head", model, Number(year));
  assert.ok(slug);
  const url = await submitRacquetAdd(
    BEN,
    formData({ brand: "Head", model, year, ...extra }, await image()),
    store,
    undefined,
    fakeFetch,
  );
  assert.equal(url, `/racquets/${slug}`);
  store.removed.length = 0;
  clearRefreshedTags();
  return slug;
}

/** An edit form for `slug`, defaulting to the racquet's own brand, model and year (an edit is the whole form). */
async function editForm(
  slug: string,
  changes: Record<string, string> = {},
  file?: Buffer | null,
): Promise<FormData> {
  const current = await getRacquet(slug);
  assert.ok(current);
  return formData(
    {
      slug,
      brand: current.brand,
      model: racquetModel(current),
      year: String(current.year),
      ...changes,
    },
    file,
  );
}

async function update(
  slug: string,
  changes: Record<string, string> = {},
  file?: Buffer | null,
  user: Reviewer | null = BEN,
) {
  return submitRacquetUpdate(user, await editForm(slug, changes, file), store, undefined, fakeFetch);
}

type RacquetRow = typeof racquet.$inferSelect;

async function rowOf(slug: string): Promise<RacquetRow> {
  const [row] = await getDb().select().from(racquet).where(eq(racquet.slug, slug));
  return row;
}

/** The setup form for `slug`, as the real form handler reads it. */
function setupForm(slug: string, strungOn: string): FormData {
  return formData({
    racquet: slug,
    strungOn,
    kind: "full-bed",
    tensionUnit: "lb",
    mainsString: "1",
    mainsGauge: "1.25",
    mainsTension: "55",
    crossesTension: "53",
    power: "7",
    control: "8",
    comfort: "6",
    spin: "9",
    feel: "7",
  });
}

/** A setup on the racquet, through the real form handler, so it counts as a use. */
async function addSetup(slug: string): Promise<number> {
  const url = await submitSetupWithReview(BEN, setupForm(slug, "2025-02-03"));
  const match = /#setup-(\d+)$/.exec(url);
  assert.ok(match, url);
  clearRefreshedTags();
  return Number(match[1]);
}

/** Nothing changed: the row as it was, no stored or removed image, no refresh. */
async function assertUntouched(slug: string, before: RacquetRow): Promise<void> {
  assert.deepEqual(await rowOf(slug), before);
  assert.equal(store.saved.size, 1, "only the photo it was added with");
  assert.deepEqual(store.removed, []);
  assert.deepEqual(refreshedTags, []);
}

const loginFor = (slug: string) => `/login?next=${encodeURIComponent(editPath(slug))}`;

test("a visitor can't edit or delete: sent to log in, nothing changes", async () => {
  const slug = await add("Visitor");
  const before = await rowOf(slug);

  assert.equal(await update(slug, { model: "Hacked", headSize: "100" }, await image(), null), loginFor(slug));
  assert.equal(await submitRacquetDelete(null, formData({ slug }), store), loginFor(slug));
  // The slug is still read first only to know where to come back to; malformed means the list.
  assert.equal(
    await submitRacquetUpdate(null, formData({ slug: "../x" }), store),
    `/login?next=${encodeURIComponent(LIST)}`,
  );
  assert.equal(
    await submitRacquetDelete(null, formData({}), store),
    `/login?next=${encodeURIComponent(LIST)}`,
  );

  assert.deepEqual(fetched, []);
  await assertUntouched(slug, before);
});

test("an edit changes brand, model, year and specs but never the slug or id; setups keep working", async () => {
  const slug = await add("Rename", { headSize: "98", weightGrams: "300", stringMains: "16", stringCrosses: "19" });
  const before = await rowOf(slug);
  const setupId = await addSetup(slug);
  const model = uniqueModel("Renamed");

  const url = await update(slug, {
    brand: "Wilson",
    model: ` wilson   ${model} `,
    year: "2025",
    headSize: "100",
    weightGrams: "",
    balanceMm: "320",
    lengthIn: "27.25",
    stringMains: "",
    stringCrosses: "",
  });
  assert.equal(url, `${LIST}?saved=${slug}`);

  const edited = await rowOf(slug);
  assert.equal(edited.id, before.id);
  assert.equal(edited.slug, slug, "the address never changes");
  assert.equal(edited.brand, "Wilson");
  assert.equal(edited.name, `Wilson ${model}`, "the name is the brand plus the model, as when adding");
  assert.equal(edited.year, 2025);
  assert.equal(edited.generation, before.generation);
  assert.equal(edited.createdBy, before.createdBy);
  assert.equal(edited.imageSrc, before.imageSrc, "no photo given keeps the photo");
  assert.deepEqual(
    [
      edited.headSizeSqIn,
      edited.weightGrams,
      edited.balanceMm,
      edited.lengthIn,
      edited.stringMains,
      edited.stringCrosses,
    ],
    [100, null, 320, 27.25, null, null],
    "a blank spec is removed",
  );

  // The old address still resolves to the same racquet, and its setup is still there.
  assert.equal((await getRacquet(slug))?.name, `Wilson ${model}`);
  assert.ok((await getRacquetSlugs()).includes(slug));
  assert.equal((await getRacquetSetups(slug)).length, 1);
  assert.equal((await getRacquetSetups(slug))[0].id, setupId);

  // Only the catalogue is refreshed: the setup cards show no racquet details.
  assert.deepEqual(refreshedTags, ["racquets"]);
  assert.deepEqual(store.removed, []);
  assert.equal(fetched.length, 0);
});

test("any reviewer can edit a built-in racquet; its generation and descriptive alt text stay", async () => {
  const before = await rowOf("yonex-ezone-98-2022");
  assert.equal(
    await update("yonex-ezone-98-2022", { weightGrams: "306" }),
    `${LIST}?saved=yonex-ezone-98-2022`,
  );
  const edited = await rowOf("yonex-ezone-98-2022");
  assert.equal(edited.weightGrams, 306);
  assert.equal(edited.generation, "7th gen");
  assert.equal(edited.imageAlt, before.imageAlt);
  assert.equal(edited.imageSrc, before.imageSrc);
  assert.deepEqual(refreshedTags, ["racquets"]);
});

test("an edit ignores the slug length the new name would make: only an add is refused for it", async () => {
  const slug = await add("Long Slug");
  // 31 ligatures fold to a 103-character slug, over RACQUET_SLUG_MAX_LENGTH; the racquet keeps its own short slug.
  const model = "ﬃ".repeat(31);
  assert.equal(await update(slug, { model }), `${LIST}?saved=${slug}`);
  assert.equal((await rowOf(slug)).name, `Head ${model}`);
});

test("renaming a racquet with a kept photo carries the new name into the alt text", async () => {
  const slug = await add("Alt");
  const model = uniqueModel("Altered");
  await update(slug, { model, year: "2025" });
  const edited = await rowOf(slug);
  assert.equal(edited.imageAlt, `Head ${model} (2025) racquet`);
});

test("the checks are the add form's: every bad field is refused with its flag and nothing changes", async () => {
  const slug = await add("Bad Fields", { headSize: "98" });
  const before = await rowOf(slug);
  const attempts: [Record<string, string>, string][] = [
    [{ brand: "Nike" }, "brand"],
    [{ brand: "" }, "brand"],
    [{ model: "   " }, "model"],
    [{ model: "x".repeat(61) }, "model"],
    [{ model: "***" }, "model"],
    [{ year: "1989" }, "year"],
    [{ year: "20x4" }, "year"],
    [{ headSize: "69" }, "head-size"],
    [{ weightGrams: "10.5" }, "weight"],
    [{ weightGrams: "451" }, "weight"],
    [{ balanceMm: "abc" }, "balance"],
    [{ lengthIn: "30" }, "length"],
    [{ stringMains: "16", stringCrosses: "" }, "string-pattern"],
    [{ stringMains: "11", stringCrosses: "19" }, "string-pattern"],
    [{ imageUrl: "http://example.com/a.png" }, "image-link"],
    [{ imageUrl: "https://user:pw@example.com/a.png" }, "image-link"],
  ];
  for (const [changes, flag] of attempts) {
    assert.equal(await update(slug, changes), refused(slug, flag), JSON.stringify(changes));
  }
  // A text value where the model should be a file, and an image sent as text.
  const notText = await editForm(slug);
  notText.set("model", new File(["x"], "x.txt"));
  assert.equal(await submitRacquetUpdate(BEN, notText, store, undefined, fakeFetch), refused(slug, "invalid"));
  const textImage = await editForm(slug);
  textImage.set("image", "not a file");
  assert.equal(await submitRacquetUpdate(BEN, textImage, store, undefined, fakeFetch), refused(slug, "invalid"));

  assert.deepEqual(fetched, [], "nothing was fetched for a refused form");
  await assertUntouched(slug, before);
});

test("the photo is optional but never both: a file with a link is refused, not guessed", async () => {
  const slug = await add("Both");
  const before = await rowOf(slug);
  linkResult = { ok: true, bytes: await image() };
  assert.equal(
    await update(slug, { imageUrl: "https://example.com/racquet.png" }, await image()),
    refused(slug, "image-both"),
  );
  assert.equal(fetched.length, 0);
  await assertUntouched(slug, before);
});

test("a photo problem refuses the edit, removes nothing, and leaves the old photo", async () => {
  const slug = await add("Photo Problems");
  const before = await rowOf(slug);

  assert.equal(
    await update(slug, {}, Buffer.alloc(IMAGE_MAX_BYTES + 1)),
    refused(slug, "image-size"),
  );
  assert.equal(await update(slug, {}, Buffer.from("this is not an image")), refused(slug, "image-type"));
  assert.equal(await update(slug, { imageUrl: "https://example.com/a.png" }), refused(slug, "image-fetch"));
  linkResult = { ok: true, bytes: Buffer.from("<html>not an image</html>") };
  assert.equal(await update(slug, { imageUrl: "https://example.com/a.png" }), refused(slug, "image-type"));
  store.failSave = true;
  assert.equal(await update(slug, {}, await image()), refused(slug, "storage"));
  store.failSave = false;

  await assertUntouched(slug, before);
});

test("a new photo by upload replaces the old: new file stored, row saved, old file removed", async () => {
  const slug = await add("Replace Upload");
  const before = await rowOf(slug);

  assert.equal(await update(slug, { headSize: "99" }, await image(600, 400, "jpeg")), `${LIST}?saved=${slug}`);

  const edited = await rowOf(slug);
  assert.notEqual(edited.imageSrc, before.imageSrc);
  assert.deepEqual([...store.saved.keys()], [edited.imageSrc], "only the new photo is left in the store");
  assert.deepEqual(store.removed, [before.imageSrc]);
  assert.equal(edited.imageAlt, `${edited.name} (${edited.year}) racquet`);
  assert.equal(edited.headSizeSqIn, 99);
  assert.deepEqual(refreshedTags, ["racquets"]);
});

test("a new photo by link replaces the old the same way, and the link is never kept", async () => {
  const slug = await add("Replace Link");
  const before = await rowOf(slug);
  linkResult = { ok: true, bytes: await image(800, 500, "webp") };

  assert.equal(await update(slug, { imageUrl: "https://example.com/p/racquet.webp" }), `${LIST}?saved=${slug}`);

  assert.deepEqual(fetched.map((url) => url.href), ["https://example.com/p/racquet.webp"]);
  const edited = await rowOf(slug);
  assert.ok(edited.imageSrc.startsWith("https://fake.public.blob.vercel-storage.com/"));
  assert.notEqual(edited.imageSrc, before.imageSrc);
  assert.deepEqual(store.removed, [before.imageSrc]);
  assert.deepEqual([...store.saved.keys()], [edited.imageSrc]);
});

test("a duplicate brand, model and year is refused, whatever the capitals; the racquet itself isn't one", async () => {
  const taken = await add("Taken", {}, "2024");
  const other = await add("Other", { headSize: "98" }, "2024");
  const before = await rowOf(other);
  const takenModel = racquetModel((await getRacquet(taken))!);

  for (const model of [takenModel, takenModel.toUpperCase(), ` head   ${takenModel.replace(" ", "-")}! `]) {
    assert.equal(await update(other, { model }, await image()), refused(other, "exists"), model);
  }
  // Another year is another racquet.
  assert.equal(await update(other, { model: takenModel, year: "2025" }), `${LIST}?saved=${other}`);
  assert.equal((await rowOf(other)).year, 2025);

  // And the same racquet saved again with no change is not its own duplicate.
  clearRefreshedTags();
  assert.equal(await update(other, { model: takenModel, year: "2025" }), `${LIST}?saved=${other}`);

  // A built-in can't be copied by an edit either.
  assert.equal(
    await update(other, { brand: "Yonex", model: "ezone 98", year: "2022" }),
    refused(other, "exists"),
  );
  assert.equal((await rowOf(taken)).name, `Head ${takenModel}`);
  assert.equal(before.id, (await rowOf(other)).id);
});

test("the duplicate rule follows a rename: the new name is taken, and so is the old address", async () => {
  const slug = await add("Moved", {}, "2024");
  const oldModel = racquetModel((await getRacquet(slug))!);
  const newModel = uniqueModel("Moved To");
  await update(slug, { model: newModel });
  clearRefreshedTags();
  store.reset();

  const withPhoto = async (model: string) =>
    submitRacquetAdd(BEN, formData({ brand: "Head", model, year: "2024" }, await image()), store, undefined, fakeFetch);

  // The racquet is now called newModel, even though its address is still the old one.
  assert.equal(await withPhoto(newModel), "/account/racquets/new?error=exists");
  // The old address still belongs to it, so a new racquet can't take it.
  assert.equal(await withPhoto(oldModel), "/account/racquets/new?error=exists");
  assert.equal(store.saved.size, 0, "refused before its photo was stored");
  assert.deepEqual(refreshedTags, []);
});

test("an edit that loses a race (racquet deleted, or its new name taken) removes its new photo", async () => {
  const slug = await add("Race Gone");
  const clash = await add("Race Clash");
  const stored = store.saved.size;

  // The other reviewer deletes the racquet after the new photo was stored.
  store.afterSave = async () => {
    await getDb().delete(racquet).where(eq(racquet.slug, slug));
  };
  assert.equal(await update(slug, { headSize: "99" }, await image()), NOT_FOUND);
  assert.equal(store.saved.size, stored, "the new photo is removed again");
  assert.equal(store.removed.length, 1);
  assert.equal(await rowOf(slug), undefined);
  assert.deepEqual(refreshedTags, []);

  // Another reviewer takes the new name after the photo was stored: the transaction decides.
  const other = await add("Race Other");
  const otherBefore = await rowOf(other);
  store.reset();
  store.afterSave = async () => {
    await getDb()
      .update(racquet)
      .set({ name: "Head Race Wanted", year: 2025 })
      .where(eq(racquet.slug, clash));
  };
  assert.equal(
    await update(other, { model: "Race Wanted", year: "2025" }, await image()),
    refused(other, "exists"),
  );
  assert.equal(store.saved.size, 0, "the loser's photo is removed");
  assert.equal(store.removed.length, 1);
  assert.deepEqual(await rowOf(other), otherBefore);
});

test("a row that can't be saved leaves no orphan photo and keeps the old one", async () => {
  const slug = await add("Atomic");
  const before = await rowOf(slug);

  // The write fails after the new photo is stored.
  store.afterSave = async () => {
    await getDb().run(
      sql`CREATE TRIGGER racquet_edit_fails BEFORE UPDATE ON racquet BEGIN SELECT RAISE(ABORT, 'boom'); END`,
    );
  };
  try {
    await assert.rejects(update(slug, { headSize: "99" }, await image()), (error: Error) =>
      /boom/.test(String((error.cause as Error | undefined)?.message)),
    );
  } finally {
    await getDb().run(sql`DROP TRIGGER IF EXISTS racquet_edit_fails`);
  }

  assert.deepEqual(await rowOf(slug), before, "the row is exactly as it was");
  assert.deepEqual([...store.saved.keys()], [before.imageSrc], "no orphan blob, and the old photo is still there");
  assert.equal(store.removed.length, 1, "only the new photo was removed");
  assert.notEqual(store.removed[0], before.imageSrc);
  assert.deepEqual(refreshedTags, []);
});

test("an unknown or malformed racquet goes back to the list as not-found, saving and deleting nothing", async () => {
  const slug = await add("Other Racquet");
  const before = await rowOf(slug);
  const form = async (value: string | File) => {
    const data = await editForm(slug);
    data.set("slug", value);
    return data;
  };

  for (const value of ["no-such-racquet-2024", "../etc", "UPPER", "", "x".repeat(200), new File(["a"], "a.txt")]) {
    assert.equal(await submitRacquetUpdate(BEN, await form(value), store, undefined, fakeFetch), NOT_FOUND);
  }
  assert.equal(await submitRacquetUpdate(BEN, formData({ brand: "Head" }), store), NOT_FOUND);
  assert.equal(await submitRacquetDelete(BEN, formData({ slug: "../etc" }), store), NOT_FOUND);
  assert.equal(await submitRacquetDelete(BEN, formData({}), store), NOT_FOUND);
  assert.deepEqual(fetched, []);
  await assertUntouched(slug, before);
});

test("the reviewer who edits is whoever is logged in: no field of the form can name one", async () => {
  const slug = await add("Who");
  const before = await rowOf(slug);
  const sneaky = await editForm(slug, { createdBy: "2", reviewer: "2", id: "999" });
  assert.equal(await submitRacquetUpdate(BEN, sneaky, store, undefined, fakeFetch), `${LIST}?saved=${slug}`);
  const edited = await rowOf(slug);
  assert.equal(edited.createdBy, before.createdBy);
  assert.equal(edited.id, before.id);
});

test("a racquet no setup uses is deleted with its photo, and its page and listing go", async () => {
  const slug = await add("Deletable");
  const { imageSrc } = await rowOf(slug);

  assert.equal(await submitRacquetDelete(BEN, formData({ slug }), store), `${LIST}?deleted=1`);

  assert.equal(await rowOf(slug), undefined);
  assert.equal(await getRacquet(slug), undefined);
  assert.ok(!(await getRacquetSlugs()).includes(slug), "generateStaticParams no longer lists it");
  const listed = (await getRacquetsByBrandWithUsage()).flatMap((section) => section.racquets);
  assert.ok(!listed.some((entry) => entry.slug === slug));
  assert.deepEqual(store.removed, [imageSrc]);
  assert.equal(store.saved.size, 0);
  // /racquets, the page and the slug list carry "racquets"; its cached setup list goes too.
  assert.deepEqual([...refreshedTags].sort(), ["racquets", `setups:${slug}`].sort());

  // A double-submitted Delete is done, not an error, and removes and refreshes nothing more.
  clearRefreshedTags();
  store.removed.length = 0;
  assert.equal(await submitRacquetDelete(BEN, formData({ slug }), store), `${LIST}?deleted=1`);
  assert.deepEqual(store.removed, []);
  assert.deepEqual(refreshedTags, []);
});

test("a racquet a setup uses can't be deleted: refused, and nothing is deleted or removed", async () => {
  const slug = await add("In Use");
  const before = await rowOf(slug);
  await addSetup(slug);

  assert.equal(await submitRacquetDelete(BEN, formData({ slug }), store), refused(slug, "in-use"));

  await assertUntouched(slug, before);
  assert.equal((await getRacquetSetups(slug)).length, 1);
  assert.ok(await getRacquet(slug));
});

test("which racquets are in use follows the setups, and the usage cache is refreshed when that changes", async () => {
  const slug = await add("Usage");
  const inUse = async () =>
    (await getRacquetsByBrandWithUsage()).flatMap((section) => section.racquets).find((entry) => entry.slug === slug)
      ?.inUse;
  assert.equal(await inUse(), false);

  const url = await submitSetupWithReview(BEN, setupForm(slug, "2025-03-04"));
  assert.ok(refreshedTags.includes("racquet-usage"), "a new setup refreshes the usage list");
  assert.equal(await inUse(), true);

  clearRefreshedTags();
  const setupId = /#setup-(\d+)$/.exec(url)![1];
  await submitDeleteReview(BEN, formData({ setup: setupId }));
  assert.ok(refreshedTags.includes("racquet-usage"), "removing the last review frees the racquet again");
  assert.equal(await inUse(), false);

  // The other racquets were never in use; the list covers every brand in order.
  const sections = await getRacquetsByBrandWithUsage();
  assert.deepEqual(sections.map((section) => section.brand), ["Yonex", "Babolat", "Head", "Tecnifibre", "Wilson"]);
});
