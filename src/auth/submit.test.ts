// Must be first: it sets up the test database and stands in for next/cache (see the file).
import { clearRefreshedTags, refreshedTags } from "@/data/test-database";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { hashPassword, verifyPassword } from "@/auth/password";
import { passwordFingerprint, signSession, verifySession } from "@/auth/session";
import { submitPasswordChange } from "@/auth/submit";
import { getReviewerCredentialsById, setReviewerPasswordHash, type Reviewer } from "@/data/reviewers";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/data/limits";

// Fresh database: reviewer 1 is Ben, with no password set until a test sets one.
const BEN: Reviewer = { id: 1, username: "ben", displayName: "Ben" };
const OLD_PASSWORD = "old-tennis-password";
const NEW_PASSWORD = "new-tennis-password";

beforeEach(async () => {
  clearRefreshedTags();
  process.env.SESSION_SECRET = "test-secret-that-is-at-least-32-characters-long";
  await setReviewerPasswordHash(BEN.username, await hashPassword(OLD_PASSWORD));
});

function form(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
}

function changeForm(overrides: Record<string, string> = {}): FormData {
  return form({
    currentPassword: OLD_PASSWORD,
    newPassword: NEW_PASSWORD,
    confirmPassword: NEW_PASSWORD,
    ...overrides,
  });
}

async function storedHash(): Promise<string | null> {
  return (await getReviewerCredentialsById(BEN.id))?.passwordHash ?? null;
}

test("a visitor can't change a password", async () => {
  assert.deepEqual(await submitPasswordChange(null, changeForm()), {
    redirect: "/login?next=%2Faccount",
    changed: false,
  });
  assert.equal(await verifyPassword(OLD_PASSWORD, await storedHash()), true);
  assert.deepEqual(refreshedTags, []);
});

test("a right current password changes it: the new one verifies, the old one doesn't", async () => {
  assert.deepEqual(await submitPasswordChange(BEN, changeForm()), {
    redirect: "/account?changed=1",
    changed: true,
  });
  const hash = await storedHash();
  assert.equal(await verifyPassword(NEW_PASSWORD, hash), true);
  assert.equal(await verifyPassword(OLD_PASSWORD, hash), false);
});

test("a wrong current password is refused and changes nothing", async () => {
  const result = await submitPasswordChange(BEN, changeForm({ currentPassword: "wrong-current-1" }));
  assert.equal(result.changed, false);
  assert.equal(result.redirect, "/account?error=current");
  assert.equal(await verifyPassword(OLD_PASSWORD, await storedHash()), true);
});

test("a new password below the minimum length is refused", async () => {
  const short = "x".repeat(PASSWORD_MIN_LENGTH - 1);
  const result = await submitPasswordChange(
    BEN,
    changeForm({ newPassword: short, confirmPassword: short }),
  );
  assert.equal(result.redirect, "/account?error=short");
  assert.equal(await verifyPassword(OLD_PASSWORD, await storedHash()), true);
});

test("a new password of exactly the minimum length is accepted", async () => {
  const atMinimum = "x".repeat(PASSWORD_MIN_LENGTH);
  const result = await submitPasswordChange(
    BEN,
    changeForm({ newPassword: atMinimum, confirmPassword: atMinimum }),
  );
  assert.equal(result.changed, true);
  assert.equal(await verifyPassword(atMinimum, await storedHash()), true);
});

test("a mismatched confirmation is refused", async () => {
  const result = await submitPasswordChange(BEN, changeForm({ confirmPassword: "different-1" }));
  assert.equal(result.changed, false);
  assert.equal(result.redirect, "/account?error=mismatch");
  assert.equal(await verifyPassword(OLD_PASSWORD, await storedHash()), true);
});

test("a new password the same as the current one is refused", async () => {
  const result = await submitPasswordChange(
    BEN,
    changeForm({ newPassword: OLD_PASSWORD, confirmPassword: OLD_PASSWORD }),
  );
  assert.equal(result.changed, false);
  assert.equal(result.redirect, "/account?error=same");
  assert.equal(await verifyPassword(OLD_PASSWORD, await storedHash()), true);
});

test("a missing field or an over-long one is refused as invalid", async () => {
  const missing = form({ currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD });
  assert.equal((await submitPasswordChange(BEN, missing)).redirect, "/account?error=invalid");

  const oversized = changeForm({ newPassword: "x".repeat(PASSWORD_MAX_LENGTH + 1) });
  assert.equal((await submitPasswordChange(BEN, oversized)).redirect, "/account?error=invalid");

  assert.equal(await verifyPassword(OLD_PASSWORD, await storedHash()), true);
});

test("other sessions stop matching after a change; a freshly re-issued one stays valid", async () => {
  const oldHash = await storedHash();
  assert.ok(oldHash, "old hash should be set");
  // What the current device's cookie carries before the change, and what
  // every other device's still carries after it: the old hash's fingerprint.
  const oldToken = signSession({
    sub: BEN.id,
    exp: Math.floor(Date.now() / 1000) + 3600,
    pwd: passwordFingerprint(oldHash),
  });

  const result = await submitPasswordChange(BEN, changeForm());
  assert.equal(result.changed, true);

  const newHash = await storedHash();
  assert.ok(newHash, "new hash should be set");
  // The same check getCurrentReviewer runs: the old token still verifies as
  // signed and unexpired, but its fingerprint no longer matches the stored
  // hash, so the reviewer is logged out on every device that kept it.
  const oldPayload = verifySession(oldToken);
  assert.equal(oldPayload?.pwd, passwordFingerprint(oldHash), "old token still verifies");
  assert.notEqual(oldPayload?.pwd, passwordFingerprint(newHash), "old fingerprint is stale");

  // The action re-issues the session with the new hash, which is exactly
  // what the fresh cookie carries: the changing device stays logged in.
  const freshPayload = verifySession(
    signSession({ sub: BEN.id, exp: Math.floor(Date.now() / 1000) + 3600, pwd: passwordFingerprint(newHash) }),
  );
  assert.equal(freshPayload?.pwd, passwordFingerprint(newHash));
  assert.equal(freshPayload?.sub, BEN.id);
});