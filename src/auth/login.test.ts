// Must be first: it sets up the test database and stands in for next/cache (see the file).
import { attemptRow } from "@/data/test-database";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { sql } from "drizzle-orm";
import { loginAttemptKeys } from "@/auth/attempt-keys";
import { hashPassword } from "@/auth/password";
import { submitLogin } from "@/auth/submit";
import { IP_FAILURE_LIMIT, LOGIN_FAILURE_LIMIT } from "@/data/limits";
import { setReviewerEmail, setReviewerPasswordHash } from "@/data/reviewers";
import { getDb } from "@/db/client";
import { loginAttempt } from "@/db/schema";

// Fresh database: reviewer 1 is Ben, 2 is Michal. Only Ben gets an email and
// a password; Michal stands in for a reviewer with no password.
const BEN_ID = 1;
const BEN_EMAIL = "ben@example.com";
const PASSWORD = "correct-horse-battery";
const WRONG_PASSWORD = "wrong-horse-battery";

// A fixed clock and two addresses: time is moved by arithmetic, never slept
// through, and no request headers are invented.
const NOW = 1_700_000_000;
const IP_A = "198.51.100.4";
const IP_B = "198.51.100.99";

const FAILED = "/login?failed=1&next=%2Faccount";
const LOCKED = (minutes: number) => `/login?locked=${minutes}&next=%2Faccount`;

beforeEach(async () => {
  process.env.SESSION_SECRET = "test-secret-that-is-at-least-32-characters-long";
  await getDb().delete(loginAttempt);
  await setReviewerEmail(BEN_ID, BEN_EMAIL);
  await setReviewerPasswordHash("ben", await hashPassword(PASSWORD));
});

function form(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set("email", BEN_EMAIL);
  formData.set("password", PASSWORD);
  formData.set("next", "/account");
  for (const [name, value] of Object.entries(overrides)) formData.set(name, value);
  return formData;
}

function attempt(overrides: Record<string, string>, now: number, ip: string) {
  return submitLogin(form(overrides), { now, ip });
}

/** `times` wrong-password attempts at one instant from one address, one after another. */
async function failTimes(
  times: number,
  { now, ip, email = BEN_EMAIL }: { now: number; ip: string; email?: string },
) {
  let result = await attempt({ email, password: WRONG_PASSWORD }, now, ip);
  for (let i = 1; i < times; i++) {
    result = await attempt({ email, password: WRONG_PASSWORD }, now, ip);
  }
  return result;
}

// --- Logging in by email ---

test("logs in with the email address, whatever the capitals and spacing", async () => {
  for (const email of [BEN_EMAIL, "  Ben@Example.COM  "]) {
    const result = await attempt({ email }, NOW, IP_A);
    assert.equal(result.redirect, "/account");
    assert.equal(result.session?.id, BEN_ID);
  }
});

test("a username is refused even with the right password, and starts no session", async () => {
  for (const email of ["ben", "BEN", "  Ben  ", "ben@", "michal"]) {
    assert.deepEqual(await attempt({ email, password: PASSWORD }, NOW, IP_A), { redirect: FAILED }, email);
  }
});

test("a failure keeps ?next=, and an unsafe one is dropped", async () => {
  assert.equal((await attempt({ password: WRONG_PASSWORD, next: "/" }, NOW, IP_A)).redirect, "/login?failed=1");
  assert.equal(
    (await attempt({ password: WRONG_PASSWORD, next: "https://evil.example" }, NOW, IP_A)).redirect,
    "/login?failed=1",
  );
});

// --- Unknown, wrong and passwordless are indistinguishable ---

test("an unknown email, a username, a wrong password and a passwordless reviewer all answer the same", async () => {
  await setReviewerEmail(2, "michal@example.com");
  const results = [
    await attempt({ email: "nobody@example.com", password: PASSWORD }, NOW, IP_A),
    await attempt({ email: "nobody", password: PASSWORD }, NOW, IP_A),
    await attempt({ email: "ben", password: PASSWORD }, NOW, IP_A),
    await attempt({ email: BEN_EMAIL, password: WRONG_PASSWORD }, NOW, IP_A),
    // Michal has an email but no password set: the no-stored-hash path.
    await attempt({ email: "michal@example.com", password: PASSWORD }, NOW, IP_A),
    await attempt({ email: "michal@example.com", password: WRONG_PASSWORD }, NOW, IP_A),
  ];
  for (const result of results) {
    assert.deepEqual(result, { redirect: FAILED }, "the same result, and no session started");
  }
});

test("a reviewer with no email can't log in", async () => {
  // Otavio has a password but no email: nothing typed can name him.
  await setReviewerPasswordHash("otavio", await hashPassword(PASSWORD));
  for (const email of ["otavio", "", "   "]) {
    assert.deepEqual(await attempt({ email, password: PASSWORD }, NOW, IP_A), { redirect: FAILED }, email);
  }
});

test("a hand-made request without an email, or with over-long fields, fails the same way", async () => {
  const noEmail = new FormData();
  noEmail.set("password", PASSWORD);
  assert.deepEqual(await submitLogin(noEmail, { now: NOW, ip: IP_A }), {
    redirect: "/login?failed=1",
  });

  const overLong = await attempt({ email: "x".repeat(300), password: "y".repeat(2000) }, NOW, IP_A);
  assert.deepEqual(overLong, { redirect: FAILED });
});

// --- The limiter ---

test("the fifth failure locks, the right password is refused while locked, and works after", async () => {
  assert.equal((await failTimes(LOGIN_FAILURE_LIMIT, { now: NOW, ip: IP_A })).redirect, FAILED);

  // The sixth attempt has the right password and is still refused: while
  // locked the password isn't checked at all.
  const locked = await attempt({}, NOW, IP_A);
  assert.deepEqual(locked, { redirect: LOCKED(1) });

  // Still locked a second before it lifts.
  assert.equal((await attempt({}, NOW + 59, IP_A)).redirect, LOCKED(1));

  // The moment it lifts, the right password works and clears the counter.
  const after = await attempt({}, NOW + 60, IP_A);
  assert.equal(after.redirect, "/account");
  assert.equal(after.session?.id, BEN_ID);
});

test("the limit is the fifth attempt: four failures leave the right password working", async () => {
  await failTimes(LOGIN_FAILURE_LIMIT - 1, { now: NOW, ip: IP_A });
  assert.equal((await attempt({}, NOW, IP_A)).redirect, "/account");
});

test("lockout steps escalate: a minute, five, fifteen, fifteen", async () => {
  await failTimes(LOGIN_FAILURE_LIMIT, { now: NOW, ip: IP_A });
  assert.equal((await attempt({}, NOW, IP_A)).redirect, LOCKED(1));

  // Past the first lock, five more failures earn the five-minute step.
  let now = NOW + 60;
  await failTimes(LOGIN_FAILURE_LIMIT, { now, ip: IP_A });
  assert.equal((await attempt({}, now, IP_A)).redirect, LOCKED(5));
  assert.equal((await attempt({}, now + 299, IP_A)).redirect, LOCKED(1));

  now += 300;
  await failTimes(LOGIN_FAILURE_LIMIT, { now, ip: IP_A });
  assert.equal((await attempt({}, now, IP_A)).redirect, LOCKED(15));

  now += 15 * 60;
  await failTimes(LOGIN_FAILURE_LIMIT, { now, ip: IP_A });
  assert.equal((await attempt({}, now, IP_A)).redirect, LOCKED(15), "the step stops at fifteen");
});

test("after a quiet half hour the steps start over from a minute", async () => {
  await failTimes(LOGIN_FAILURE_LIMIT, { now: NOW, ip: IP_A });
  const later = NOW + 60 + 30 * 60;
  await failTimes(LOGIN_FAILURE_LIMIT, { now: later, ip: IP_A });
  assert.equal((await attempt({}, later, IP_A)).redirect, LOCKED(1));
});

test("the same email typed another way is the same counter", async () => {
  for (const email of [BEN_EMAIL, "BEN@example.com", " ben@Example.com", "Ben@example.COM ", BEN_EMAIL]) {
    await failTimes(1, { now: NOW, ip: IP_A, email });
  }
  assert.equal((await attempt({}, NOW, IP_A)).redirect, LOCKED(1));
});

test("a username is counted by the limiter like any unknown email, and can't lock Ben's email", async () => {
  // Right password every time: a username never gets as far as a match.
  for (let i = 0; i < LOGIN_FAILURE_LIMIT; i++) {
    assert.equal((await attempt({ email: "ben", password: PASSWORD }, NOW, IP_A)).redirect, FAILED);
  }
  assert.deepEqual(await attempt({ email: "ben", password: PASSWORD }, NOW, IP_A), { redirect: LOCKED(1) });

  // Same rows as an unknown email failing the same way.
  await failTimes(LOGIN_FAILURE_LIMIT, { now: NOW, ip: IP_A, email: "nobody@example.com" });
  const username = await attemptRow(loginAttemptKeys("ben", IP_A).pair.key);
  const unknown = await attemptRow(loginAttemptKeys("nobody@example.com", IP_A).pair.key);
  assert.equal(username?.lockedUntil, unknown?.lockedUntil);
  assert.equal(username?.lockoutLevel, unknown?.lockoutLevel);
  assert.equal(username?.failures, unknown?.failures);

  // The public username is a different counter from Ben's email, so
  // hammering it locks nobody out of the real login, even from that address.
  assert.equal((await attempt({}, NOW, IP_A)).redirect, "/account");
});

test("a stranger's failures from another address can't lock a reviewer out", async () => {
  // The stranger's failures are keyed to their own address.
  await failTimes(LOGIN_FAILURE_LIMIT, { now: NOW, ip: IP_A });
  // That address is locked out of Ben's email...
  assert.equal((await attempt({}, NOW, IP_A)).redirect, LOCKED(1));
  // ...but Ben, with the right password from his own address, gets in.
  const result = await attempt({}, NOW, IP_B);
  assert.equal(result.redirect, "/account");
  assert.equal(result.session?.id, BEN_ID);
});

test("one address spraying many emails hits the per-IP counter", async () => {
  for (let i = 0; i < IP_FAILURE_LIMIT; i++) {
    const result = await failTimes(1, { now: NOW, ip: IP_A, email: `spray-${i}@example.com` });
    assert.equal(result.redirect, FAILED);
  }

  // The address is now locked out of every email, even with the right
  // password for one of them.
  const blocked = await attempt({ password: PASSWORD }, NOW, IP_A);
  assert.deepEqual(blocked, { redirect: LOCKED(1) });

  // Another address is unaffected.
  assert.equal((await attempt({ password: PASSWORD }, NOW, IP_B)).redirect, "/account");
});

test("a success clears the (email, IP) counter but leaves the IP one where it was", async () => {
  await failTimes(2, { now: NOW, ip: IP_A });
  const keys = loginAttemptKeys(BEN_EMAIL, IP_A);
  assert.equal((await attemptRow(keys.pair.key))?.failures, 2);
  assert.equal((await attemptRow(keys.ip.key))?.failures, 2);

  assert.equal((await attempt({}, NOW, IP_A)).redirect, "/account");
  assert.equal(await attemptRow(keys.pair.key), undefined, "the pair counter is forgotten");
  assert.equal((await attemptRow(keys.ip.key))?.failures, 2, "the IP counter keeps what the failures earned");

  // Both counters behave from here as if the success never happened: three
  // more failures make five on the IP counter's own terms, but the pair
  // counter, cleared by the success, needs five of its own.
  await failTimes(LOGIN_FAILURE_LIMIT - 1, { now: NOW, ip: IP_A });
  assert.equal((await attempt({}, NOW, IP_A)).redirect, "/account");
});

test("a successful login doesn't use up the IP counter's budget", async () => {
  // IP_FAILURE_LIMIT - 1 failures across emails, one real login between.
  for (let i = 0; i < IP_FAILURE_LIMIT - 1; i++) {
    await failTimes(1, { now: NOW, ip: IP_A, email: `spray-${i}@example.com` });
  }
  assert.equal((await attempt({}, NOW, IP_A)).redirect, "/account");
  // One more failure is the IP limit's last attempt: it's let through, the one after is refused.
  assert.equal((await failTimes(1, { now: NOW, ip: IP_A, email: "spray-last@example.com" })).redirect, FAILED);
  assert.equal((await attempt({}, NOW, IP_A)).redirect, LOCKED(1));
});

test("an unknown email is counted exactly like a known one", async () => {
  const unknown = "nobody@example.com";
  await failTimes(LOGIN_FAILURE_LIMIT, { now: NOW, ip: IP_A, email: unknown });

  const state = await attemptRow(loginAttemptKeys(unknown, IP_A).pair.key);
  assert.ok((state?.lockedUntil ?? 0) > NOW, "the unknown email is locked too");
  assert.equal(state?.lockoutLevel, 1);

  // The same rows, the same answers, for a known account failing the same way.
  await failTimes(LOGIN_FAILURE_LIMIT, { now: NOW, ip: IP_B, email: BEN_EMAIL });
  const known = await attemptRow(loginAttemptKeys(BEN_EMAIL, IP_B).pair.key);
  assert.equal(known?.lockedUntil, state?.lockedUntil);
  assert.equal(known?.lockoutLevel, state?.lockoutLevel);
  assert.equal(known?.failures, state?.failures);

  assert.deepEqual(await attempt({ email: unknown, password: PASSWORD }, NOW, IP_A), {
    redirect: LOCKED(1),
  });
  assert.deepEqual(await attempt({ email: BEN_EMAIL }, NOW, IP_B), { redirect: LOCKED(1) });
});

test("a no-address request is its own bucket and can't lock a reviewer who has an address", async () => {
  const noIp = (overrides: Record<string, string>) => submitLogin(form(overrides), { now: NOW, ip: null });
  for (let i = 0; i < LOGIN_FAILURE_LIMIT; i++) await noIp({ password: WRONG_PASSWORD });
  assert.deepEqual(await noIp({}), { redirect: LOCKED(1) });
  assert.equal((await attempt({}, NOW, IP_A)).redirect, "/account");
});

test("a burst of simultaneous wrong guesses gets exactly the limit checked, the rest refused", async () => {
  // Thirty parallel guesses, at one instant, from one address at Ben's
  // email. Each is counted before its password is checked, so exactly the
  // limit are checked (and fail); the other 25 are refused unchecked.
  const results = await Promise.all(
    Array.from({ length: 30 }, () => attempt({ password: WRONG_PASSWORD }, NOW, IP_A)),
  );
  assert.equal(results.filter((r) => r.redirect === FAILED).length, LOGIN_FAILURE_LIMIT);
  assert.equal(results.filter((r) => r.redirect === LOCKED(1)).length, 30 - LOGIN_FAILURE_LIMIT);
  assert.equal(results.filter((r) => r.session).length, 0);
});

test("once a burst has used the last attempt, the right password is refused", async () => {
  // Four failures first, so exactly one more attempt is admitted. Ten wrong
  // guesses at once: one is checked, nine are refused unchecked.
  await failTimes(LOGIN_FAILURE_LIMIT - 1, { now: NOW, ip: IP_A });
  const results = await Promise.all(
    Array.from({ length: 10 }, () => attempt({ password: WRONG_PASSWORD }, NOW, IP_A)),
  );
  assert.equal(results.filter((r) => r.redirect === FAILED).length, 1);
  assert.equal(results.filter((r) => r.redirect === LOCKED(1)).length, 9);

  assert.deepEqual(await attempt({}, NOW, IP_A), { redirect: LOCKED(1) });
});

test("fail closed: when the counters can't be written, even the right password is refused", async () => {
  await getDb().run(sql`ALTER TABLE login_attempt RENAME TO login_attempt_away`);
  try {
    const result = await attempt({}, NOW, IP_A);
    assert.deepEqual(result, { redirect: "/login?locked=0&next=%2Faccount" });
  } finally {
    await getDb().run(sql`ALTER TABLE login_attempt_away RENAME TO login_attempt`);
  }
  // And it works again once the table is back.
  assert.equal((await attempt({}, NOW, IP_A)).redirect, "/account");
});
