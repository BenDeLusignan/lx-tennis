import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { signSession, verifySession, type SessionPayload } from "@/auth/session";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const NOW = 1_800_000_000;
const payload: SessionPayload = { sub: 1, exp: NOW + 60, pwd: "fingerprint" };

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
});

test("accepts its own unexpired token", () => {
  assert.deepEqual(verifySession(signSession(payload), NOW), payload);
});

test("rejects an expired token", () => {
  assert.equal(verifySession(signSession(payload), NOW + 60), null);
});

test("rejects a token whose payload was edited", () => {
  const [, signature] = signSession(payload).split(".");
  const forged = Buffer.from(JSON.stringify({ ...payload, sub: 2 })).toString("base64url");
  assert.equal(verifySession(`${forged}.${signature}`, NOW), null);
});

test("rejects a token signed with a different secret", () => {
  process.env.SESSION_SECRET = `${SECRET}-rotated`;
  const token = signSession(payload);
  process.env.SESSION_SECRET = SECRET;
  assert.equal(verifySession(token, NOW), null);
});

test("rejects malformed tokens", () => {
  for (const token of ["", "abc", "a.b.c", `${signSession(payload)}x`]) {
    assert.equal(verifySession(token, NOW), null, token);
  }
});

test("refuses to sign with a short secret", () => {
  process.env.SESSION_SECRET = "too-short";
  assert.throws(() => signSession(payload), /SESSION_SECRET/);
});
