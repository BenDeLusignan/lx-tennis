import assert from "node:assert/strict";
import { test } from "node:test";
import {
  liveState,
  lockoutRemainingSeconds,
  lockoutWaitMinutes,
  nextAttemptState,
  type AttemptState,
} from "@/data/attempt-rules";
import {
  FAILURE_WINDOW_MINUTES,
  IP_FAILURE_LIMIT,
  LOCKOUT_STEPS_MINUTES,
  LOGIN_FAILURE_LIMIT,
} from "@/data/limits";

// A fixed clock, in Unix seconds: these tests move time by arithmetic
// instead of sleeping.
const NOW = 1_700_000_000;
const WINDOW = FAILURE_WINDOW_MINUTES * 60;
const LIMIT = LOGIN_FAILURE_LIMIT;

/** `times` attempts at the same instant, starting from `from`. */
function attempts(times: number, now = NOW, limit = LIMIT, from: AttemptState | null = null) {
  let state = from;
  for (let i = 0; i < times; i++) state = nextAttemptState(state, now, limit);
  return state!;
}

test("the window outlasts the longest lockout, so a step survives its own lockout", () => {
  assert.ok(FAILURE_WINDOW_MINUTES > Math.max(...LOCKOUT_STEPS_MINUTES));
});

test("attempts below the limit count up but don't lock", () => {
  const state = attempts(LIMIT - 1);
  assert.equal(state.failures, LIMIT - 1);
  assert.equal(state.lockedUntil, 0);
  assert.equal(state.lockoutLevel, 0);
  assert.equal(state.windowExpiresAt, NOW + WINDOW);
  assert.equal(lockoutRemainingSeconds(state, NOW), 0);
});

test("the attempt that reaches the limit starts the first lockout and restarts the count", () => {
  const state = attempts(LIMIT);
  assert.equal(state.lockedUntil, NOW + LOCKOUT_STEPS_MINUTES[0] * 60);
  assert.equal(state.lockoutLevel, 1);
  assert.equal(state.failures, 0, "the next lockout needs a full set of attempts again");
  assert.equal(lockoutRemainingSeconds(state, NOW), LOCKOUT_STEPS_MINUTES[0] * 60);
});

test("lockout steps escalate: a minute, five, fifteen, then fifteen again", () => {
  let state = attempts(LIMIT);
  const lengths: number[] = [LOCKOUT_STEPS_MINUTES[0]];
  let now = NOW;
  for (let lockout = 1; lockout < 4; lockout++) {
    now = state.lockedUntil + 1;
    state = attempts(LIMIT, now, LIMIT, state);
    lengths.push((state.lockedUntil - now) / 60);
  }
  assert.deepEqual(lengths, [1, 5, 15, 15]);
  assert.equal(state.lockoutLevel, LOCKOUT_STEPS_MINUTES.length, "the level stops climbing");
});

test("a lockout doesn't start before the limit even after earlier lockouts", () => {
  const locked = attempts(LIMIT);
  const after = attempts(LIMIT - 1, locked.lockedUntil + 1, LIMIT, locked);
  assert.equal(after.lockedUntil, 0);
  assert.equal(after.lockoutLevel, 1, "the step is remembered");
});

test("a quiet window resets the count and the step", () => {
  const locked = attempts(LIMIT);
  const afterWindow = nextAttemptState(locked, locked.windowExpiresAt, LIMIT);
  assert.equal(afterWindow.failures, 1);
  assert.equal(afterWindow.lockedUntil, 0);
  assert.equal(afterWindow.lockoutLevel, 0);
});

test("the window slides: each attempt pushes it out", () => {
  const first = attempts(1);
  const later = nextAttemptState(first, NOW + 600, LIMIT);
  assert.equal(later.windowExpiresAt, NOW + 600 + WINDOW);
  assert.equal(later.failures, 2);
});

test("liveState is blank for an absent or lapsed row", () => {
  const state = attempts(2);
  assert.equal(liveState(state, NOW), state);
  assert.equal(liveState(null, NOW).windowExpiresAt, 0);
  assert.equal(liveState(undefined, NOW).failures, 0);
  assert.equal(liveState(state, state.windowExpiresAt).failures, 0, "lapsed exactly at the window's end");
});

test("lockoutRemainingSeconds stops at zero, and lockoutWaitMinutes rounds up", () => {
  const locked = attempts(LIMIT);
  assert.equal(lockoutRemainingSeconds(locked, locked.lockedUntil), 0);
  assert.equal(lockoutRemainingSeconds(locked, locked.lockedUntil + 1), 0);
  assert.equal(lockoutRemainingSeconds(null, NOW), 0);
  assert.equal(lockoutWaitMinutes(0), 1, "never '0 minutes'");
  assert.equal(lockoutWaitMinutes(1), 1);
  assert.equal(lockoutWaitMinutes(60), 1);
  assert.equal(lockoutWaitMinutes(61), 2);
  assert.equal(lockoutWaitMinutes(15 * 60), 15);
});

test("the IP counter's higher limit needs more attempts to lock", () => {
  assert.ok(IP_FAILURE_LIMIT > LIMIT);
  assert.equal(attempts(IP_FAILURE_LIMIT - 1, NOW, IP_FAILURE_LIMIT).lockedUntil, 0);
  assert.ok(attempts(IP_FAILURE_LIMIT, NOW, IP_FAILURE_LIMIT).lockedUntil > NOW);
});
