// Must be first: it sets up the test database and stands in for next/cache (see the file).
import { clearRefreshedTags, refreshedTags } from "@/data/test-database";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import type { Reviewer } from "@/data/reviewers";
import { getStringsWithUsage, type TennisString } from "@/data/strings";
import { submitSetupWithReview } from "@/reviews/submit";
import { submitStringDelete, submitStringUpdate } from "@/strings/submit";

// Seeded on a fresh database: reviewer 1 is Ben; strings 1–10 are Ben's ten.
const BEN: Reviewer = { id: 1, username: "ben", displayName: "Ben" };
const POLYTOUR_PRO = 1;
const POLYTOUR_FIRE = 2;
const HYPER_G = 6;

beforeEach(clearRefreshedTags);

function form(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
}

async function findString(id: number): Promise<(TennisString & { inUse: boolean }) | undefined> {
  return (await getStringsWithUsage()).find((string) => string.id === id);
}

test("a visitor can't edit or delete a string", async () => {
  const before = await findString(POLYTOUR_FIRE);
  assert.equal(
    await submitStringUpdate(null, form({ id: String(POLYTOUR_FIRE), brand: "X", name: "Y", type: "polyester" })),
    "/login?next=%2Faccount%2Fstrings",
  );
  assert.equal(
    await submitStringDelete(null, form({ id: String(POLYTOUR_FIRE) })),
    "/login?next=%2Faccount%2Fstrings",
  );
  assert.deepEqual(await findString(POLYTOUR_FIRE), before);
  assert.deepEqual(refreshedTags, []);
});

test("an edit is trimmed, saved, and refreshes the string list and every racquet page", async () => {
  const url = await submitStringUpdate(
    BEN,
    form({ id: String(HYPER_G), brand: " Solinco ", name: "Hyper-G ", type: "co-polyester" }),
  );
  assert.equal(url, `/account/strings?saved=${HYPER_G}`);
  // The list, and every racquet page (its cards show the string's name).
  assert.deepEqual([...refreshedTags].sort(), ["setups", "strings"]);
  const saved = await findString(HYPER_G);
  assert.deepEqual([saved?.brand, saved?.name], ["Solinco", "Hyper-G"]);
});

test("a string can change only its capitals", async () => {
  const url = await submitStringUpdate(
    BEN,
    form({ id: String(HYPER_G), brand: "SOLINCO", name: "Hyper-G", type: "co-polyester" }),
  );
  assert.equal(url, `/account/strings?saved=${HYPER_G}`);
  assert.equal((await findString(HYPER_G))?.brand, "SOLINCO");
});

test("an edit can't give a string another string's brand and name, whatever the capitals", async () => {
  const url = await submitStringUpdate(
    BEN,
    form({ id: String(POLYTOUR_FIRE), brand: "yonex", name: "Polytour Pro", type: "polyester" }),
  );
  assert.equal(url, "/account/strings?error=string-exists");
  assert.equal((await findString(POLYTOUR_FIRE))?.name, "POLYTOUR FIRE");
  assert.deepEqual(refreshedTags, []);
});

test("an edit needs a brand, a name, a listed type and a real string", async () => {
  const good = { id: String(POLYTOUR_FIRE), brand: "Yonex", name: "POLYTOUR FIRE", type: "polyester" };
  for (const bad of [
    { brand: "  " },
    { name: "" },
    { type: "Polyester" },
    { id: "abc" },
    { id: "999999" },
  ]) {
    assert.equal(
      await submitStringUpdate(BEN, form({ ...good, ...bad })),
      "/account/strings?error=invalid",
      JSON.stringify(bad),
    );
  }
});

test("a string in use can't be deleted", async () => {
  const url = await submitSetupWithReview(
    BEN,
    form({
      racquet: "yonex-vcore-98-2023",
      strungOn: "2026-01-10",
      kind: "hybrid",
      tensionUnit: "lb",
      mainsString: String(POLYTOUR_PRO),
      mainsGauge: "1.25",
      mainsTension: "55",
      // Only the crosses use it: that counts too.
      crossesString: String(POLYTOUR_FIRE),
      crossesGauge: "1.25",
      crossesTension: "53",
      power: "7",
      control: "8",
      comfort: "6",
      spin: "9",
      feel: "7",
    }),
  );
  assert.match(url, /^\/racquets\/yonex-vcore-98-2023#setup-\d+$/);
  assert.equal((await findString(POLYTOUR_FIRE))?.inUse, true);
  clearRefreshedTags();

  assert.equal(
    await submitStringDelete(BEN, form({ id: String(POLYTOUR_FIRE) })),
    "/account/strings?error=in-use",
  );
  assert.ok(await findString(POLYTOUR_FIRE));
  assert.deepEqual(refreshedTags, []);
});

test("an unused string can be deleted, and deleting it again isn't an error", async () => {
  const unused = (await getStringsWithUsage()).find((string) => !string.inUse);
  assert.ok(unused);
  assert.equal(await submitStringDelete(BEN, form({ id: String(unused.id) })), "/account/strings?deleted=1");
  assert.equal(await findString(unused.id), undefined);
  assert.deepEqual(refreshedTags, ["strings"]);

  // A double-submitted Delete.
  assert.equal(await submitStringDelete(BEN, form({ id: String(unused.id) })), "/account/strings?deleted=1");
  assert.equal(await submitStringDelete(BEN, form({ id: "-1" })), "/account/strings?error=invalid");
});
