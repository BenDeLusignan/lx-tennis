// Must be first: it sets up the test database and stands in for next/cache (see the file).
import "@/data/test-database";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getReviewerCredentialsByEmail,
  getReviewerEmail,
  setReviewerEmail,
  type Reviewer,
} from "@/data/reviewers";
import { addReview, createSetupWithReview, getRacquetSetups } from "@/data/setups";

// Fresh database: reviewers 1–3 are Ben, Michal and Otavio, all with a null
// email until a test sets one.

test("a setup's reviews are only the reviewers who reviewed it, by id, and never carry an email", async () => {
  // Ben has an email first, so this pins the rule against a future
  // `select()` of the whole row: a reader that stops spelling out its
  // columns would bake the email into the cached, prerendered score grid.
  // (Not Otavio: a later test relies on his email being null.)
  await setReviewerEmail(1, "ben@example.com");

  const ben: Reviewer = { id: 1, username: "ben", displayName: "Ben" };
  const otavio: Reviewer = { id: 3, username: "otavio", displayName: "Otavio" };
  const review = { scores: { power: 7, control: 7, comfort: 7, spin: 7, feel: 7 }, body: null };
  const slug = "yonex-ezone-98-2022";
  const side = { string: { id: 1 }, gaugeHundredthsMm: 125, tensionTenths: 550 };

  // Otavio first, then Ben: the columns still follow reviewer id, not who
  // got there first. Michal never reviews it, so he has no column at all.
  const created = await createSetupWithReview(
    { racquetSlug: slug, strungOn: "2025-01-10", tensionUnit: "lb", mains: side, crosses: side, review },
    otavio,
  );
  assert.equal(created.status, "created");
  if (created.status !== "created") return;
  await addReview(created.setupId, review, ben);

  const setups = await getRacquetSetups(slug);
  const found = setups.find((setup) => setup.id === created.setupId);
  assert.ok(found);
  assert.deepEqual(
    found.reviews.map(({ reviewer }) => reviewer.id),
    [1, 3],
  );
  for (const { reviewer } of found.reviews) {
    assert.ok(!("email" in reviewer), "a public Reviewer must not have an email field");
  }
});

test("getReviewerEmail reads the stored address, or null when none is set", async () => {
  // Reviewer 3 (Otavio) gets no email from any test in this file, so it
  // starts as the seed has it: null.
  assert.equal(await getReviewerEmail(3), null);
  await setReviewerEmail(3, "otavio@example.com");
  assert.equal(await getReviewerEmail(3), "otavio@example.com");
});

test("setReviewerEmail refuses an address another reviewer already has", async () => {
  await setReviewerEmail(1, "ben@example.com");
  assert.equal(await setReviewerEmail(2, "ben@example.com"), "email-used");
  assert.equal(await getReviewerEmail(2), null);
});

test("the login lookup finds a reviewer by email only, whatever the capitals, and carries no email", async () => {
  await setReviewerEmail(1, "ben@example.com");

  for (const email of ["ben@example.com", " Ben@Example.COM "]) {
    const found = await getReviewerCredentialsByEmail(email);
    assert.ok(found, email);
    assert.equal(found.id, 1, email);
    assert.ok(!("email" in found), "credentials never carry the email");
  }

  // A username finds nothing, nor does an address that isn't stored, a
  // fragment of one, or blank text.
  for (const typed of ["ben", "  BEN ", "ben@", "michal@example.com", "nobody", "", "   "]) {
    assert.equal(await getReviewerCredentialsByEmail(typed), undefined, JSON.stringify(typed));
  }
});
