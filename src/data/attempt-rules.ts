/**
 * The failed-attempt limiter's rules, as pure functions of a stored counter
 * and the clock. Pure (no `server-only`, no database) so they can be tested
 * on their own, with time passed in rather than slept through; the storage
 * is in `src/data/attempts.ts` and the thresholds in `src/data/limits.ts`.
 *
 * One counter is one key: either a (typed email, IP) pair, or one IP across
 * every email typed. See `src/data/limits.ts` for why both exist.
 */

import { FAILURE_WINDOW_MINUTES, LOCKOUT_STEPS_MINUTES } from "@/data/limits";

/** One stored counter. All times are Unix seconds. */
export interface AttemptState {
  /** Attempts counted towards the next lockout. Back to 0 each time one starts. */
  failures: number;
  /** When the streak stops counting and starts again from zero. */
  windowExpiresAt: number;
  /** When the lockout ends; 0 (or any past time) means not locked. */
  lockedUntil: number;
  /** Lockouts this key has reached in the window; picks the escalating step. */
  lockoutLevel: number;
}

/** A key with no history: nothing counted, never locked. */
const NO_ATTEMPTS: AttemptState = { failures: 0, windowExpiresAt: 0, lockedUntil: 0, lockoutLevel: 0 };

/**
 * The counter as it stands at `now`: what's stored, or a blank one when the
 * row is absent or its window has lapsed (a quiet streak is over, and so is
 * the escalation it had reached).
 */
export function liveState(state: AttemptState | null | undefined, now: number): AttemptState {
  return state != null && state.windowExpiresAt > now ? state : NO_ATTEMPTS;
}

/** Locked seconds left at `now`; 0 when it isn't locked. An absent row never is. */
export function lockoutRemainingSeconds(
  state: AttemptState | null | undefined,
  now: number,
): number {
  if (state == null || state.lockedUntil <= now) return 0;
  return state.lockedUntil - now;
}

/**
 * The wait told to the person who's locked out, in whole minutes. Rounded
 * up, so it never promises "try again now" before the lock has lifted, and
 * at least 1, so it can't read as "0 minutes".
 */
export function lockoutWaitMinutes(remainingSeconds: number): number {
  return Math.max(1, Math.ceil(remainingSeconds / 60));
}

/**
 * The counter after one more attempt is admitted at `now`. `limit` is the
 * attempts that trigger a lockout (5 for one (typed email, IP) pair, 20 for
 * one IP alone). The caller has already refused anything that arrives while
 * the key is locked, so this never sees a live lock.
 *
 * The attempt is counted *before* its password is checked (see
 * `src/data/attempts.ts`), so the `limit`th attempt is the last one let
 * through: it starts the lockout, and everything after it is refused.
 *
 * The window slides: each attempt pushes `windowExpiresAt` out, so a streak
 * only stops counting after `FAILURE_WINDOW_MINUTES` of quiet. Each lockout
 * restarts the count at zero and moves to the next step (a minute, then
 * five, then fifteen, then fifteen again), so every step costs `limit` more
 * wrong passwords, and the step survives the lockout itself because the
 * window is longer than the longest step.
 */
export function nextAttemptState(
  current: AttemptState | null | undefined,
  now: number,
  limit: number,
): AttemptState {
  const previous = liveState(current, now);
  const failures = previous.failures + 1;
  const windowExpiresAt = now + FAILURE_WINDOW_MINUTES * 60;

  if (failures < limit) {
    return { failures, windowExpiresAt, lockedUntil: 0, lockoutLevel: previous.lockoutLevel };
  }

  const step = LOCKOUT_STEPS_MINUTES[Math.min(previous.lockoutLevel, LOCKOUT_STEPS_MINUTES.length - 1)];
  return {
    failures: 0,
    windowExpiresAt,
    lockedUntil: now + step * 60,
    lockoutLevel: Math.min(previous.lockoutLevel + 1, LOCKOUT_STEPS_MINUTES.length),
  };
}
