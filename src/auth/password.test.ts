import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "@/auth/password";

test("verifies the right password and rejects others", async () => {
  const hash = await hashPassword("correct horse battery");
  assert.equal(await verifyPassword("correct horse battery", hash), true);
  assert.equal(await verifyPassword("correct horse batterY", hash), false);
  assert.equal(await verifyPassword("", hash), false);
});

test("salts every hash", async () => {
  assert.notEqual(await hashPassword("same password"), await hashPassword("same password"));
});

test("never accepts a missing or malformed hash", async () => {
  assert.equal(await verifyPassword("anything", null), false);
  assert.equal(await verifyPassword("anything", "not-a-hash"), false);
  assert.equal(await verifyPassword("anything", ""), false);
});

test("matches a password however its accents were composed", async () => {
  const hash = await hashPassword("Ota\u0301vio tennis");
  assert.equal(await verifyPassword("Ot\u00e1vio tennis", hash), true);
});
