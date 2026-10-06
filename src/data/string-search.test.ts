// Must be first: it sets up the test database and stands in for next/cache (see the file).
import "@/data/test-database";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Reviewer } from "@/data/reviewers";
import { createSetupWithReview, getStringSetups, type NewSetupSide } from "@/data/setups";
import { getStringsByBrand } from "@/data/strings";

// Seeded on a fresh database: reviewer 1 is Ben, racquets are the four
// built-ins, strings 1–10 are POLYTOUR PRO, FIRE, DRIVE, REV, SPIN (Yonex)
// and Hyper-G, Hyper-G Soft, Confidential, Confidential Soft, Mach-10 (Solinco).
const BEN: Reviewer = { id: 1, username: "ben", displayName: "Ben" };
const EZONE = "yonex-ezone-98-2022";
const VCORE = "yonex-vcore-98-2023";
const POLYTOUR_PRO = 1;
const POLYTOUR_FIRE = 2;
const HYPER_G = 6;

const side = (string: NewSetupSide["string"], gaugeHundredthsMm: number): NewSetupSide => ({
  string,
  gaugeHundredthsMm,
  tensionTenths: 550,
});

async function addSetup(racquetSlug: string, strungOn: string, mains: NewSetupSide, crosses: NewSetupSide) {
  const result = await createSetupWithReview(
    {
      racquetSlug,
      strungOn,
      tensionUnit: "lb",
      mains,
      crosses,
      review: { scores: { power: 7, control: 7, comfort: 7, spin: 7, feel: 7 }, body: null },
    },
    BEN,
  );
  assert.equal(result.status, "created");
  return result.status === "created" ? result.setupId : -1;
}

test("a string's setups are the ones with it in the mains, the crosses or both, each once, newest first", async () => {
  const fullBed = await addSetup(EZONE, "2025-01-10", side({ id: POLYTOUR_PRO }, 125), side({ id: POLYTOUR_PRO }, 125));
  // One string in two gauges: still one setup.
  const twoGauges = await addSetup(VCORE, "2025-01-11", side({ id: POLYTOUR_PRO }, 125), side({ id: POLYTOUR_PRO }, 130));
  const onCrosses = await addSetup(EZONE, "2025-01-12", side({ id: HYPER_G }, 125), side({ id: POLYTOUR_PRO }, 125));
  const onMains = await addSetup(EZONE, "2025-01-13", side({ id: HYPER_G }, 125), side({ id: POLYTOUR_FIRE }, 125));

  const ids = async (stringId: number) => (await getStringSetups(stringId)).map((found) => found.id);
  // Newest strung first, across racquets; the full bed is in once, not twice.
  assert.deepEqual(await ids(POLYTOUR_PRO), [onCrosses, twoGauges, fullBed]);
  assert.deepEqual(await ids(HYPER_G), [onMains, onCrosses]);
  assert.deepEqual(await ids(POLYTOUR_FIRE), [onMains]);

  // A string nobody used, and an id that isn't a string, have none: never invented.
  assert.deepEqual(await ids(3), []);
  assert.deepEqual(await ids(999_999), []);

  // Each setup carries both sides, so the card can show the whole stringing.
  const [crossesMatch] = await getStringSetups(POLYTOUR_PRO);
  assert.equal(crossesMatch.mains.string.id, HYPER_G);
  assert.equal(crossesMatch.crosses.string.id, POLYTOUR_PRO);
  assert.equal(crossesMatch.fullBed, false);
});

test("the string list is a section per brand, ignoring capitals, with untested strings marked", async () => {
  // The same brand in other capitals, added from a setup form, joins the section.
  await addSetup(
    EZONE,
    "2025-02-01",
    side({ new: { brand: "solinco", name: "Tour Bite", type: "co-polyester" } }, 125),
    side({ new: { brand: "solinco", name: "Tour Bite", type: "co-polyester" } }, 125),
  );

  const sections = await getStringsByBrand();
  assert.deepEqual(
    sections.map(({ brand, strings }) => [brand, strings.map(({ name }) => name)]),
    [
      ["Solinco", ["Confidential", "Confidential Soft", "Hyper-G", "Hyper-G Soft", "Mach-10", "Tour Bite"]],
      ["Yonex", ["POLYTOUR DRIVE", "POLYTOUR FIRE", "POLYTOUR PRO", "POLYTOUR REV", "POLYTOUR SPIN"]],
    ],
  );

  const tested = sections.flatMap(({ strings }) => strings.filter((string) => string.inUse).map(({ name }) => name));
  assert.deepEqual(tested.sort(), ["Hyper-G", "POLYTOUR FIRE", "POLYTOUR PRO", "Tour Bite"]);
});
