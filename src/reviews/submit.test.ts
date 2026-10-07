// Must be first: it sets up the test database and stands in for next/cache (see the file).
import { clearRefreshedTags, refreshedTags } from "@/data/test-database";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { and, eq } from "drizzle-orm";
import type { Reviewer } from "@/data/reviewers";
import { createSetupWithReview, getRacquetSetups, getSetup } from "@/data/setups";
import { getStrings, getStringsWithUsage } from "@/data/strings";
import { getDb } from "@/db/client";
import { review } from "@/db/schema";
import { submitDeleteReview, submitReview, submitReviewEdit, submitSetupWithReview } from "@/reviews/submit";

// Seeded on a fresh database: reviewers 1–3, racquets 1–4, strings 1–10.
const BEN: Reviewer = { id: 1, username: "ben", displayName: "Ben" };
const MICHAL: Reviewer = { id: 2, username: "michal", displayName: "Michal" };
const OTAVIO: Reviewer = { id: 3, username: "otavio", displayName: "Otavio" };
const SLUG = "yonex-ezone-98-2022";
const FORM_PATH = `/account/racquets/${SLUG}/new`;
const POLYTOUR_PRO = 1;
const HYPER_G = 6;

beforeEach(clearRefreshedTags);

let day = 0;
/** A date no other test uses, so their setups never count as duplicates of each other. */
function nextDate(): string {
  return new Date(Date.UTC(2025, 0, 1 + day++)).toISOString().slice(0, 10);
}

function form(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
}

const SCORES = { power: "7", control: "8", comfort: "6", spin: "9", feel: "7" };

/** POLYTOUR PRO 1.25 mm, full bed at 55/53 lb. */
function fullBed(overrides: Record<string, string> = {}): FormData {
  return form({
    racquet: SLUG,
    strungOn: nextDate(),
    kind: "full-bed",
    tensionUnit: "lb",
    mainsString: String(POLYTOUR_PRO),
    mainsGauge: "1.25",
    mainsTension: "55",
    crossesTension: "53",
    ...SCORES,
    body: "Crisp.",
    ...overrides,
  });
}

/** The setup id from a redirect to `/racquets/<slug>#setup-<id>`. */
function createdId(url: string): number {
  const match = new RegExp(`^/racquets/${SLUG}#setup-(\\d+)$`).exec(url);
  assert.ok(match, `expected a redirect to the new card, got ${url}`);
  return Number(match[1]);
}

async function stringNames(): Promise<string[]> {
  return (await getStrings()).map((string) => `${string.brand} ${string.name}`);
}

test("a visitor is sent to log in and nothing is saved", async () => {
  const before = (await getRacquetSetups(SLUG)).length;
  assert.equal(
    await submitSetupWithReview(null, fullBed()),
    `/login?next=${encodeURIComponent(FORM_PATH)}`,
  );
  assert.equal(
    await submitReview(null, form({ setup: "1", ...SCORES })),
    `/login?next=${encodeURIComponent("/account/setups/1/review")}`,
  );
  assert.equal((await getRacquetSetups(SLUG)).length, before);
  assert.deepEqual(refreshedTags, []);
});

test("a full bed is saved with the mains' string and gauge on the crosses, and refreshes the racquet page", async () => {
  const id = createdId(
    await submitSetupWithReview(BEN, fullBed({ crossesString: String(HYPER_G), crossesGauge: "1.20" })),
  );
  const setup = await getSetup(id);
  assert.ok(setup);
  assert.equal(setup.fullBed, true);
  assert.equal(setup.tensionUnit, "lb");
  assert.deepEqual(
    [setup.mains.string.id, setup.mains.gaugeMm, setup.mains.tension],
    [POLYTOUR_PRO, 1.25, 55],
  );
  assert.deepEqual(
    [setup.crosses.string.id, setup.crosses.gaugeMm, setup.crosses.tension],
    [POLYTOUR_PRO, 1.25, 53],
  );
  assert.deepEqual(setup.reviews, [
    {
      reviewer: BEN,
      scores: { power: 7, control: 8, comfort: 6, spin: 9, feel: 7 },
      body: "Crisp.",
    },
  ]);
  assert.ok(refreshedTags.includes(`setups:${SLUG}`));
  // The racquet now has a setup, so it can't be deleted from /account/racquets.
  assert.ok(refreshedTags.includes("racquet-usage"));
});

test("a hybrid with a new string adds the string, the setup and the review", async () => {
  const id = createdId(
    await submitSetupWithReview(
      BEN,
      fullBed({
        kind: "hybrid",
        crossesString: "new",
        crossesNewBrand: "Babolat",
        crossesNewName: "VS Touch",
        crossesNewType: "natural-gut",
        crossesGauge: "1.30",
        body: "",
      }),
    ),
  );
  const setup = await getSetup(id);
  assert.ok(setup);
  assert.equal(setup.fullBed, false);
  assert.deepEqual(
    [setup.crosses.string.brand, setup.crosses.string.name, setup.crosses.string.type],
    ["Babolat", "VS Touch", "natural-gut"],
  );
  assert.equal(setup.crosses.gaugeMm, 1.3);
  assert.equal(setup.reviews[0].body, null);
  assert.ok((await stringNames()).includes("Babolat VS Touch"));
  // The string list changed too.
  assert.ok(refreshedTags.includes("strings"));
});

test("the same new string on both sides of a hybrid is added once", async () => {
  const id = createdId(
    await submitSetupWithReview(
      BEN,
      fullBed({
        kind: "hybrid",
        mainsString: "new",
        mainsNewBrand: "Luxilon",
        mainsNewName: "ALU Power",
        mainsNewType: "polyester",
        crossesString: "new",
        crossesNewBrand: "Luxilon",
        crossesNewName: "alu power",
        crossesNewType: "polyester",
        crossesGauge: "1.30",
      }),
    ),
  );
  const setup = await getSetup(id);
  assert.equal(setup?.mains.string.id, setup?.crosses.string.id);
  assert.equal((await stringNames()).filter((name) => name === "Luxilon ALU Power").length, 1);
});

test("the same new string on both sides with different types is refused, and nothing is added", async () => {
  const url = await submitSetupWithReview(
    BEN,
    fullBed({
      kind: "hybrid",
      mainsString: "new",
      mainsNewBrand: "Kirschbaum",
      mainsNewName: "Max Power",
      mainsNewType: "polyester",
      crossesString: "new",
      crossesNewBrand: "Kirschbaum",
      crossesNewName: "Max Power",
      crossesNewType: "co-polyester",
      crossesGauge: "1.30",
    }),
  );
  assert.equal(url, `${FORM_PATH}?error=invalid`);
  assert.ok(!(await stringNames()).includes("Kirschbaum Max Power"));
});

test("entering a setup you haven't reviewed that's already on the site points to its review page, even in the other unit", async () => {
  const strungOn = nextDate();
  const existing = createdId(await submitSetupWithReview(BEN, fullBed({ strungOn })));
  clearRefreshedTags();

  // 55 lb and 53 lb are 24.9 kg and 24.0 kg to 1 dp: the same stringing.
  const again = fullBed({ strungOn, tensionUnit: "kg", mainsTension: "24.9", crossesTension: "24" });
  assert.equal(
    await submitSetupWithReview(MICHAL, again),
    `/account/setups/${existing}/review?existing=1`,
  );
  const setups = await getRacquetSetups(SLUG);
  assert.equal(setups.filter((setup) => setup.strungOn === strungOn).length, 1);
  // Michal's scores weren't attached to it: he adds his review there.
  assert.deepEqual(
    (await getSetup(existing))?.reviews.map((review) => review.reviewer.id),
    [BEN.id],
  );
  assert.deepEqual(refreshedTags, []);
});

test("entering a setup you've already reviewed goes back to the form with the error and that setup's id, saving nothing", async () => {
  const strungOn = nextDate();
  const existing = createdId(await submitSetupWithReview(BEN, fullBed({ strungOn })));
  clearRefreshedTags();

  // Other scores and the other unit: still the same setup, and Ben's review stays as it was.
  const again = fullBed({
    strungOn,
    tensionUnit: "kg",
    mainsTension: "24.9",
    crossesTension: "24",
    power: "1",
    body: "Different.",
  });
  assert.equal(
    await submitSetupWithReview(BEN, again),
    `${FORM_PATH}?error=already-reviewed&setup=${existing}`,
  );
  assert.equal((await getRacquetSetups(SLUG)).filter((setup) => setup.strungOn === strungOn).length, 1);
  const [kept] = (await getSetup(existing))?.reviews ?? [];
  assert.equal(kept.scores.power, 7);
  assert.equal(kept.body, "Crisp.");
  assert.deepEqual(refreshedTags, []);
});

test("a new string whose brand and name already exist, in other capitals, is refused", async () => {
  const before = await stringNames();
  const url = await submitSetupWithReview(
    BEN,
    fullBed({
      mainsString: "new",
      mainsNewBrand: "yonex",
      mainsNewName: "polytour PRO",
      mainsNewType: "polyester",
    }),
  );
  assert.equal(url, `${FORM_PATH}?error=string-exists`);
  assert.deepEqual(await stringNames(), before);
});

test("a string id that doesn't exist is refused", async () => {
  assert.equal(
    await submitSetupWithReview(BEN, fullBed({ mainsString: "999999" })),
    `${FORM_PATH}?error=invalid`,
  );
});

test("form errors go back to the form as a code, never what was typed", async () => {
  assert.equal(await submitSetupWithReview(BEN, fullBed({ mainsTension: "95" })), `${FORM_PATH}?error=tension`);
  assert.equal(await submitSetupWithReview(BEN, fullBed({ racquet: "no-such-racquet" })), "/racquets");
  assert.equal(await submitSetupWithReview(BEN, fullBed({ racquet: "../../evil" })), "/racquets");
});

test("if saving the setup fails, the new string it added is rolled back", async () => {
  const before = await stringNames();
  // Past the form's checks (as a bug might let through), the database's own
  // range check refuses the setup after the string has been inserted.
  await assert.rejects(
    createSetupWithReview(
      {
        racquetSlug: SLUG,
        strungOn: nextDate(),
        tensionUnit: "lb",
        mains: {
          string: { new: { brand: "Tecnifibre", name: "X-One Biphase", type: "multifilament" } },
          gaugeHundredthsMm: 124,
          tensionTenths: 900,
        },
        crosses: { string: { id: POLYTOUR_PRO }, gaugeHundredthsMm: 125, tensionTenths: 530 },
        review: { scores: { power: 7, control: 8, comfort: 6, spin: 9, feel: 7 }, body: null },
      },
      BEN,
    ),
    // Drizzle wraps the driver's error; the constraint name is in the cause.
    (error: Error) => {
      assert.match(String(error.cause), /CHECK constraint failed: setup_mains_tension_valid/);
      return true;
    },
  );
  assert.deepEqual(await stringNames(), before);
  assert.deepEqual(refreshedTags, []);
});

test("a reviewer adds their review to someone else's setup once", async () => {
  const id = createdId(await submitSetupWithReview(BEN, fullBed()));
  clearRefreshedTags();

  assert.equal(
    await submitReview(MICHAL, form({ setup: String(id), ...SCORES, spin: "4", body: "" })),
    `/racquets/${SLUG}#setup-${id}`,
  );
  // The racquet's page, and every string's results (the setup could be on any).
  assert.deepEqual(refreshedTags, [`setups:${SLUG}`, "string-setups"]);

  // Already reviewed: back to the review page, which says so; nothing changes.
  clearRefreshedTags();
  assert.equal(
    await submitReview(MICHAL, form({ setup: String(id), ...SCORES, spin: "10" })),
    `/account/setups/${id}/review`,
  );
  const reviews = (await getSetup(id))?.reviews ?? [];
  assert.deepEqual(
    reviews.map((review) => [review.reviewer.id, review.scores.spin]),
    [
      [BEN.id, 9],
      [MICHAL.id, 4],
    ],
  );
  assert.deepEqual(refreshedTags, []);
});

test("a review's errors go back to the review page as a code", async () => {
  const id = createdId(await submitSetupWithReview(BEN, fullBed()));
  assert.equal(
    await submitReview(MICHAL, form({ setup: String(id), ...SCORES, feel: "0" })),
    `/account/setups/${id}/review?error=scores`,
  );
  assert.equal(
    await submitReview(MICHAL, form({ setup: "999999", ...SCORES })),
    "/account/setups/999999/review?error=invalid",
  );
  assert.equal(await submitReview(MICHAL, form({ setup: "abc", ...SCORES })), "/racquets");
});

test("a racquet's setups come newest strung first", async () => {
  const older = createdId(await submitSetupWithReview(BEN, fullBed({ strungOn: "2020-01-01" })));
  const newer = createdId(await submitSetupWithReview(BEN, fullBed({ strungOn: "2020-01-02" })));
  const ids = (await getRacquetSetups(SLUG)).map((setup) => setup.id);
  assert.ok(ids.indexOf(newer) < ids.indexOf(older));
});

/** A reviewer's stored review of a setup, straight from the table (the readers don't show times). */
async function storedReview(setupId: number, reviewerId: number) {
  const [row] = await getDb()
    .select()
    .from(review)
    .where(and(eq(review.setupId, setupId), eq(review.reviewerId, reviewerId)));
  return row;
}

const EDIT = { power: "3", control: "4", comfort: "5", spin: "6", feel: "10", body: "Softer than I thought." };

test("a visitor can't edit a review and is sent to log in", async () => {
  const id = createdId(await submitSetupWithReview(BEN, fullBed()));
  clearRefreshedTags();

  assert.equal(
    await submitReviewEdit(null, form({ setup: String(id), ...EDIT })),
    `/login?next=${encodeURIComponent(`/account/setups/${id}/review`)}`,
  );
  const stored = await storedReview(id, BEN.id);
  assert.equal(stored.power, 7);
  assert.equal(stored.body, "Crisp.");
  assert.deepEqual(refreshedTags, []);
});

test("a reviewer edits their own review: scores and text change, the time moves, the racquet page refreshes", async () => {
  const id = createdId(await submitSetupWithReview(BEN, fullBed()));
  // Push updated_at into the past so "the time moved" doesn't depend on the clock's second.
  await getDb()
    .update(review)
    .set({ updatedAt: new Date(0) })
    .where(and(eq(review.setupId, id), eq(review.reviewerId, BEN.id)));
  const before = await storedReview(id, BEN.id);
  assert.equal(before.updatedAt.getTime(), 0);
  clearRefreshedTags();

  assert.equal(
    await submitReviewEdit(BEN, form({ setup: String(id), ...EDIT })),
    `/racquets/${SLUG}#setup-${id}`,
  );

  const after = await storedReview(id, BEN.id);
  assert.deepEqual(
    [after.power, after.control, after.comfort, after.spin, after.feel, after.body],
    [3, 4, 5, 6, 10, "Softer than I thought."],
  );
  assert.ok(after.updatedAt.getTime() > 0);
  assert.equal(after.createdAt.getTime(), before.createdAt.getTime());
  assert.deepEqual(refreshedTags, [`setups:${SLUG}`, "string-setups"]);

  // A blank written review clears it.
  assert.equal(
    await submitReviewEdit(BEN, form({ setup: String(id), ...EDIT, body: "  " })),
    `/racquets/${SLUG}#setup-${id}`,
  );
  assert.equal((await storedReview(id, BEN.id)).body, null);
});

test("a reviewer can't change another reviewer's review, whatever the form says", async () => {
  const id = createdId(await submitSetupWithReview(BEN, fullBed()));
  await submitReview(MICHAL, form({ setup: String(id), ...SCORES, body: "Michal's" }));
  const bens = await storedReview(id, BEN.id);
  clearRefreshedTags();

  // Michal edits, and also tries to name Ben and his review in the form:
  // only his own row, found by his session, changes.
  await submitReviewEdit(
    MICHAL,
    form({ setup: String(id), reviewer: String(BEN.id), reviewerId: String(BEN.id), review: String(bens.id), id: String(bens.id), ...EDIT }),
  );

  assert.deepEqual(await storedReview(id, BEN.id), bens);
  const michals = await storedReview(id, MICHAL.id);
  assert.deepEqual([michals.power, michals.feel, michals.body], [3, 10, "Softer than I thought."]);
});

test("editing a setup you haven't reviewed creates nothing and leaves others' reviews alone", async () => {
  const id = createdId(await submitSetupWithReview(BEN, fullBed()));
  const bens = await storedReview(id, BEN.id);
  clearRefreshedTags();

  // Sent to the review page, which shows the add form.
  assert.equal(
    await submitReviewEdit(MICHAL, form({ setup: String(id), ...EDIT })),
    `/account/setups/${id}/review`,
  );
  assert.equal(await storedReview(id, MICHAL.id), undefined);
  assert.deepEqual(await storedReview(id, BEN.id), bens);
  assert.deepEqual(refreshedTags, []);

  assert.equal(
    await submitReviewEdit(MICHAL, form({ setup: "999999", ...EDIT })),
    "/account/setups/999999/review?error=invalid",
  );
  assert.equal(await submitReviewEdit(MICHAL, form({ setup: "abc", ...EDIT })), "/racquets");
});

test("an edit with invalid scores is refused and nothing changes", async () => {
  const id = createdId(await submitSetupWithReview(BEN, fullBed()));
  const before = await storedReview(id, BEN.id);
  clearRefreshedTags();

  for (const bad of [{ feel: "0" }, { feel: "11" }, { feel: "7.5" }, { feel: "" }, { feel: "abc" }]) {
    assert.equal(
      await submitReviewEdit(BEN, form({ setup: String(id), ...EDIT, ...bad })),
      `/account/setups/${id}/review?error=scores`,
    );
  }
  // A missing criterion, and a written review over the limit.
  const missingSpin = form({ setup: String(id), ...EDIT });
  missingSpin.delete("spin");
  assert.equal(
    await submitReviewEdit(BEN, missingSpin),
    `/account/setups/${id}/review?error=scores`,
  );
  assert.equal(
    await submitReviewEdit(BEN, form({ setup: String(id), ...EDIT, body: "x".repeat(4001) })),
    `/account/setups/${id}/review?error=invalid`,
  );

  assert.deepEqual(await storedReview(id, BEN.id), before);
  assert.deepEqual(refreshedTags, []);
});

/** Whether a setup uses the string, as /account/strings shows it ("String tested"). */
async function stringInUse(name: string): Promise<boolean> {
  const found = (await getStringsWithUsage()).find((string) => string.name === name);
  assert.ok(found, `no string named ${name}`);
  return found.inUse;
}

test("a visitor can't delete a review and is sent to log in", async () => {
  const id = createdId(await submitSetupWithReview(BEN, fullBed()));
  clearRefreshedTags();

  assert.equal(
    await submitDeleteReview(null, form({ setup: String(id) })),
    `/login?next=${encodeURIComponent(`/account/setups/${id}/review`)}`,
  );
  assert.ok(await getSetup(id));
  assert.ok(await storedReview(id, BEN.id));
  assert.deepEqual(refreshedTags, []);
});

test("deleting your review leaves the setup and everyone else's review, and refreshes the racquet page", async () => {
  const id = createdId(await submitSetupWithReview(BEN, fullBed()));
  await submitReview(MICHAL, form({ setup: String(id), ...SCORES, body: "Michal's" }));
  const michals = await storedReview(id, MICHAL.id);
  clearRefreshedTags();

  // Ben entered the setup, and deleting his review doesn't take it with it.
  assert.equal(
    await submitDeleteReview(BEN, form({ setup: String(id) })),
    `/racquets/${SLUG}#setup-${id}`,
  );

  assert.equal(await storedReview(id, BEN.id), undefined);
  assert.deepEqual(await storedReview(id, MICHAL.id), michals);
  assert.deepEqual(
    (await getSetup(id))?.reviews.map((review) => review.reviewer.id),
    [MICHAL.id],
  );
  assert.deepEqual(refreshedTags, [`setups:${SLUG}`, "string-setups"]);
});

test("deleting the last review removes the setup too, and the racquet page and string list refresh", async () => {
  const id = createdId(
    await submitSetupWithReview(
      BEN,
      fullBed({
        kind: "hybrid",
        crossesString: "new",
        crossesNewBrand: "Wilson",
        crossesNewName: "Delete Test Gut",
        crossesNewType: "natural-gut",
        crossesGauge: "1.30",
      }),
    ),
  );
  await submitReview(MICHAL, form({ setup: String(id), ...SCORES }));
  assert.equal(await stringInUse("Delete Test Gut"), true);

  // Not the last one yet: the setup stays, and so does the string's use.
  await submitDeleteReview(BEN, form({ setup: String(id) }));
  assert.ok(await getSetup(id));
  assert.equal(await stringInUse("Delete Test Gut"), true);
  clearRefreshedTags();

  // Michal didn't create the setup; it goes with his review all the same.
  assert.equal(await submitDeleteReview(MICHAL, form({ setup: String(id) })), `/racquets/${SLUG}`);

  assert.equal(await getSetup(id), undefined);
  assert.equal(await storedReview(id, MICHAL.id), undefined);
  assert.ok(!(await getRacquetSetups(SLUG)).some((setup) => setup.id === id));
  // The string stays on the list, but no setup uses it any more.
  assert.equal(await stringInUse("Delete Test Gut"), false);
  assert.deepEqual(
    [...refreshedTags].sort(),
    ["racquet-usage", "strings", `setups:${SLUG}`, "string-setups"].sort(),
  );
});

test("a reviewer can't delete another reviewer's review, whatever the form says", async () => {
  const id = createdId(await submitSetupWithReview(BEN, fullBed()));
  await submitReview(MICHAL, form({ setup: String(id), ...SCORES, body: "Michal's" }));
  const bens = await storedReview(id, BEN.id);
  clearRefreshedTags();

  // Michal names Ben as the reviewer and Ben's review by id: only his own row,
  // found by his session, goes.
  await submitDeleteReview(
    MICHAL,
    form({
      setup: String(id),
      reviewer: String(BEN.id),
      reviewerId: String(BEN.id),
      review: String(bens.id),
      id: String(bens.id),
    }),
  );

  assert.deepEqual(await storedReview(id, BEN.id), bens);
  assert.equal(await storedReview(id, MICHAL.id), undefined);
  assert.ok(await getSetup(id));

  // A reviewer with no review of the setup, forging Ben's ids, deletes nothing.
  clearRefreshedTags();
  assert.equal(
    await submitDeleteReview(
      OTAVIO,
      form({ setup: String(id), reviewer: String(BEN.id), reviewerId: String(BEN.id), review: String(bens.id) }),
    ),
    `/account/setups/${id}/review`,
  );
  assert.deepEqual(await storedReview(id, BEN.id), bens);
  assert.ok(await getSetup(id));
  assert.deepEqual(refreshedTags, []);
});

test("deleting a review you haven't written changes nothing", async () => {
  const id = createdId(await submitSetupWithReview(BEN, fullBed()));
  const bens = await storedReview(id, BEN.id);
  clearRefreshedTags();

  // Sent to the review page, which shows the add form.
  assert.equal(
    await submitDeleteReview(MICHAL, form({ setup: String(id) })),
    `/account/setups/${id}/review`,
  );
  assert.deepEqual(await storedReview(id, BEN.id), bens);
  assert.ok(await getSetup(id));
  assert.deepEqual(refreshedTags, []);
});

test("deleting from a setup that's already gone isn't an error", async () => {
  const id = createdId(await submitSetupWithReview(BEN, fullBed()));
  await submitDeleteReview(BEN, form({ setup: String(id) }));
  assert.equal(await getSetup(id), undefined);
  clearRefreshedTags();

  assert.equal(await submitDeleteReview(BEN, form({ setup: String(id) })), "/racquets");
  assert.equal(await submitDeleteReview(BEN, form({ setup: "999999" })), "/racquets");
  assert.equal(await submitDeleteReview(BEN, form({ setup: "abc" })), "/racquets");
  assert.deepEqual(refreshedTags, []);
});
