import assert from "node:assert/strict";
import { test } from "node:test";
import { LOCKOUT_STEPS_MINUTES } from "@/data/limits";
import { lockoutMessage } from "@/forms/lockout-message";

const LONGEST = Math.max(...LOCKOUT_STEPS_MINUTES);
const FEW = "Too many attempts. Try again in a few minutes.";

test("a real wait is told in minutes, singular for one, with a no-break space", () => {
  assert.equal(lockoutMessage("1"), "Too many attempts. Try again in 1\u00a0minute.");
  assert.equal(lockoutMessage("5"), "Too many attempts. Try again in 5\u00a0minutes.");
  assert.equal(lockoutMessage(String(LONGEST)), `Too many attempts. Try again in ${LONGEST}\u00a0minutes.`);
});

test("a wait longer than the longest real lockout is not believed", () => {
  assert.equal(lockoutMessage(String(LONGEST + 1)), FEW);
  assert.equal(lockoutMessage("99999"), FEW);
  assert.equal(lockoutMessage("999999"), FEW);
});

test("anything that isn't a positive whole number falls back to a few minutes", () => {
  for (const wait of ["-1", "1.5", "1e3", "abc", "", " 5", "5 ", "05", "+5", "0x5", "Infinity", "NaN"]) {
    assert.equal(lockoutMessage(wait), FEW, JSON.stringify(wait));
  }
  assert.equal(lockoutMessage(undefined), FEW);
  assert.equal(lockoutMessage(["5", "5"]), FEW, "a repeated parameter");
});

test("0 means the limiter couldn't be written, and says so rather than claiming a lockout", () => {
  const message = lockoutMessage("0");
  assert.equal(message, "We couldn’t check your details right now. Try again in a few minutes.");
  assert.ok(!message.includes("Too many"));
});
