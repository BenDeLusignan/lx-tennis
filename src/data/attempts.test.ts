// Must be first: it sets up the test database and stands in for next/cache (see the file).
import { attemptRow } from "@/data/test-database";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { loginAttemptKeys } from "@/auth/attempt-keys";
import { admitAttempt, settleSuccess, type Admission, type AttemptCounter } from "@/data/attempts";
import { FAILURE_WINDOW_MINUTES, IP_FAILURE_LIMIT, LOGIN_FAILURE_LIMIT } from "@/data/limits";
import { getDb } from "@/db/client";
import { loginAttempt } from "@/db/schema";

// Keys are HMACs, so SESSION_SECRET must be set before one is made.
process.env.SESSION_SECRET = "test-secret-that-is-at-least-32-characters-long";

const NOW = 1_700_000_000;
const WINDOW = FAILURE_WINDOW_MINUTES * 60;

// Plain strings stand in for the hashed keys: this file tests the storage,
// not how keys are made.
const PAIR: AttemptCounter = { key: "pair", limit: LOGIN_FAILURE_LIMIT };
const IP: AttemptCounter = { key: "ip", limit: IP_FAILURE_LIMIT };

beforeEach(async () => {
  await getDb().delete(loginAttempt);
});

function admitted(admission: Admission) {
  assert.ok(admission.admitted, "the attempt was let through");
  return admission.reservation;
}

test("an admitted attempt is counted on both counters before anything else happens", async () => {
  admitted(await admitAttempt(PAIR, IP, NOW));
  assert.deepEqual(await attemptRow("pair"), {
    attemptKey: "pair",
    failures: 1,
    windowExpiresAt: NOW + WINDOW,
    lockedUntil: 0,
    lockoutLevel: 0,
  });
  assert.equal((await attemptRow("ip"))?.failures, 1);

  admitted(await admitAttempt(PAIR, IP, NOW + 1));
  assert.equal((await attemptRow("pair"))?.failures, 2);
  assert.equal(await attemptRow("never-written"), undefined);
});

test("the attempt that reaches the limit is the last one let through", async () => {
  for (let i = 0; i < LOGIN_FAILURE_LIMIT; i++) admitted(await admitAttempt(PAIR, IP, NOW));

  const refused = await admitAttempt(PAIR, IP, NOW);
  assert.deepEqual(refused, { admitted: false, remainingSeconds: 60 });
});

test("a refused attempt counts for nothing: a lock isn't extended or escalated by hammering it", async () => {
  for (let i = 0; i < LOGIN_FAILURE_LIMIT; i++) await admitAttempt(PAIR, IP, NOW);
  const locked = await attemptRow("pair");
  const ipBefore = await attemptRow("ip");

  for (let i = 0; i < 20; i++) await admitAttempt(PAIR, IP, NOW + 30);

  assert.deepEqual(await attemptRow("pair"), locked);
  assert.deepEqual(await attemptRow("ip"), ipBefore, "the IP counter isn't charged for refused attempts either");
});

test("either counter being locked refuses the attempt", async () => {
  // The IP counter locks alone (limit 2), while this pair has only one attempt.
  const shortIp: AttemptCounter = { key: "short-ip", limit: 2 };
  admitted(await admitAttempt({ key: "pair-1", limit: 5 }, shortIp, NOW));
  admitted(await admitAttempt({ key: "pair-2", limit: 5 }, shortIp, NOW));

  const refused = await admitAttempt({ key: "pair-3", limit: 5 }, shortIp, NOW);
  assert.equal(refused.admitted, false);
  assert.equal(await attemptRow("pair-3"), undefined, "the refused pair was never counted");
});

test("a success forgets the pair and gives the IP counter its attempt back", async () => {
  admitted(await admitAttempt(PAIR, IP, NOW));
  admitted(await admitAttempt(PAIR, IP, NOW));
  const reservation = admitted(await admitAttempt(PAIR, IP, NOW));
  assert.equal((await attemptRow("ip"))?.failures, 3);

  await settleSuccess(reservation);
  assert.equal(await attemptRow("pair"), undefined, "the pair counter is forgotten");
  assert.equal((await attemptRow("ip"))?.failures, 2, "the IP counter is back where it was before this attempt");
});

test("a success on a fresh IP counter leaves no row behind", async () => {
  await settleSuccess(admitted(await admitAttempt(PAIR, IP, NOW)));
  assert.equal(await attemptRow("pair"), undefined);
  assert.equal(await attemptRow("ip"), undefined);
});

test("a success undoes an IP lockout its own attempt started", async () => {
  const tinyIp: AttemptCounter = { key: "tiny-ip", limit: 2 };
  admitted(await admitAttempt(PAIR, tinyIp, NOW));
  const reservation = admitted(await admitAttempt(PAIR, tinyIp, NOW));
  assert.ok(((await attemptRow("tiny-ip"))?.lockedUntil ?? 0) > NOW, "the attempt locked the IP counter");

  await settleSuccess(reservation);
  const back = await attemptRow("tiny-ip");
  assert.equal(back?.lockedUntil, 0, "a real login doesn't leave the address locked");
  assert.equal(back?.failures, 1);
  assert.equal(back?.lockoutLevel, 0);
});

test("a success when another attempt has since moved the IP counter just gives one count back", async () => {
  const first = admitted(await admitAttempt(PAIR, IP, NOW));
  admitted(await admitAttempt({ key: "other-pair", limit: 5 }, IP, NOW + 5));
  assert.equal((await attemptRow("ip"))?.failures, 2);

  await settleSuccess(first);
  assert.equal((await attemptRow("ip"))?.failures, 1);
  assert.equal(await attemptRow("pair"), undefined);
});

test("a write deletes rows whose window and lock have both passed", async () => {
  admitted(await admitAttempt({ key: "stale", limit: 1 }, IP, NOW));
  assert.ok(((await attemptRow("stale"))?.lockedUntil ?? 0) > NOW, "limit 1 locks at once");

  // Still inside the window: it survives another write.
  admitted(await admitAttempt({ key: "other", limit: 5 }, IP, NOW + 1));
  assert.ok(await attemptRow("stale"), "a row inside its window stays");

  // Past both the lock and the window: the next write sweeps it away.
  admitted(await admitAttempt({ key: "fresh", limit: 5 }, IP, NOW + WINDOW + 1));
  assert.equal(await attemptRow("stale"), undefined, "an expired row is deleted");
  assert.equal(await attemptRow("other"), undefined);
  assert.equal((await attemptRow("fresh"))?.failures, 1);
});

test("a lock still standing keeps its row even after the window", async () => {
  // A lock outlasting its window can't happen with the real constants (the
  // window is longer than any step), but the sweep must still never delete a
  // live lock: the row is only dead when both have passed.
  await getDb().insert(loginAttempt).values({
    attemptKey: "locked-past-window",
    failures: 0,
    windowExpiresAt: NOW - 1,
    lockedUntil: NOW + 600,
    lockoutLevel: 1,
  });
  admitted(await admitAttempt(PAIR, IP, NOW));
  assert.ok(await attemptRow("locked-past-window"));
});

test("concurrent attempts on one pair: exactly the limit get a password check, the rest are refused", async () => {
  // Thirty requests at the same instant against one (identifier, IP) pair.
  // The count is taken inside the write transaction, ahead of any password
  // check, and writers queue, so each sees the previous one's count: exactly
  // LOGIN_FAILURE_LIMIT are admitted and the other 25 are refused unchecked.
  // The guarantee: guesses per lockout never exceed the limit, however many
  // requests arrive together. (Failing closed: a request whose write errors
  // out is refused too, so the admitted count could only ever be lower.)
  const results = await Promise.all(
    Array.from({ length: 30 }, () => admitAttempt(PAIR, IP, NOW).catch(() => "error" as const)),
  );
  const admittedCount = results.filter((r) => r !== "error" && r.admitted).length;
  const errors = results.filter((r) => r === "error").length;

  assert.equal(admittedCount, LOGIN_FAILURE_LIMIT, "exactly the limit were let through");
  assert.equal(errors, 0, "no write gave up under contention");
  assert.equal((await attemptRow("pair"))?.failures, 0, "the fifth attempt started the lockout");
  assert.equal((await attemptRow("pair"))?.lockoutLevel, 1);
});

test("concurrent attempts spread over many pairs from one IP stop at the IP limit", async () => {
  const results = await Promise.all(
    Array.from({ length: 40 }, (_, i) =>
      admitAttempt({ key: `spray-${i}`, limit: LOGIN_FAILURE_LIMIT }, IP, NOW).catch(() => "error" as const),
    ),
  );
  assert.equal(results.filter((r) => r !== "error" && r.admitted).length, IP_FAILURE_LIMIT);
  assert.equal(results.filter((r) => r === "error").length, 0);
});

test("the stored keys hold no email address and no IP address", async () => {
  const keys = loginAttemptKeys("ben@example.com", "203.0.113.7");
  assert.notEqual(keys.pair.key, keys.ip.key);
  assert.equal(keys.ip.limit, IP_FAILURE_LIMIT);
  admitted(await admitAttempt(keys.pair, keys.ip, NOW));

  // A base64url HMAC-SHA256 digest: 43 characters, nothing readable in it.
  for (const key of [keys.pair.key, keys.ip.key]) {
    const row = await attemptRow(key);
    assert.ok(row, "the counter was written under its hashed key");
    assert.match(row.attemptKey, /^[A-Za-z0-9_-]{43}$/);
  }

  // Nothing anywhere in the table spells out the address or the IP.
  const stored = JSON.stringify(await getDb().select().from(loginAttempt));
  assert.ok(!stored.includes("ben@example.com"), "no raw email address");
  assert.ok(!stored.includes("example"), "no part of it either");
  assert.ok(!stored.includes("203.0.113.7"), "no raw IP address");
});

test("keys depend on SESSION_SECRET: changing it starts every counter afresh", async () => {
  const before = loginAttemptKeys("ben", "203.0.113.7");
  const secret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "another-secret-that-is-at-least-32-characters";
  try {
    const after = loginAttemptKeys("ben", "203.0.113.7");
    assert.notEqual(after.pair.key, before.pair.key);
    assert.notEqual(after.ip.key, before.ip.key);
  } finally {
    process.env.SESSION_SECRET = secret;
  }
});
