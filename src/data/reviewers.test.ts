// Must be first: it sets up the test database and stands in for next/cache (see the file).
import "@/data/test-database";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getReviewerCredentialsByEmail,
  getReviewerEmail,
  getReviewers,
  setReviewerEmail,
} from "@/data/reviewers";

// Fresh database: reviewers 1–3 are Ben, Michal and Otavio, all with a null
// email until a test sets one.

test("the public reviewer list never carries an email", async () => {
  // Set one first, so this pins the rule against a future `select()` of
  // the whole row: a reader that stops spelling out its columns would bake
  // the email into the cached, prerendered score grid.
  await setReviewerEmail(1, "ben@example.com");

  const reviewers = await getReviewers();
  assert.equal(reviewers.length, 3);
  for (const reviewer of reviewers) {
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
