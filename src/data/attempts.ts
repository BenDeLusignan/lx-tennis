import "server-only";
import { setTimeout as wait } from "node:timers/promises";
import { and, eq, lte } from "drizzle-orm";
import { getDb, type Transaction } from "@/db/client";
import { loginAttempt } from "@/db/schema";
import {
  liveState,
  lockoutRemainingSeconds,
  nextAttemptState,
  type AttemptState,
} from "@/data/attempt-rules";

/**
 * Storage for the failed-attempt limiter: one row per key (an
 * (identifier, IP) pair, or one IP across every identifier). The rules are
 * in `src/data/attempt-rules.ts`; the keys are built in
 * `src/auth/attempt-keys.ts`. Nothing here knows about passwords.
 *
 * The flow is reserve first, settle after. `admitAttempt` counts the attempt
 * *before* the password is checked, in one write transaction that also
 * refuses it if a lock is standing. A wrong password then needs nothing
 * more; a right one calls `settleSuccess` to give the count back.
 *
 * Why not check, verify, then record the failure? Because a burst of
 * requests would all pass the check before any of them was recorded, and
 * every one of them would get a password guess. Counting first makes the
 * transaction itself the gate: writers queue (`BEGIN IMMEDIATE`), so of any
 * number of simultaneous requests exactly `limit` are admitted per lockout
 * and the rest are refused without a password check.
 */

/** One counter to advance for an attempt, and the attempts that lock it. */
export interface AttemptCounter {
  key: string;
  limit: number;
}

/** What `settleSuccess` needs to undo an admitted attempt's count. */
export interface Reservation {
  pairKey: string;
  ipKey: string;
  /** The IP counter as it was before the attempt was counted. */
  ipBefore: AttemptState;
  /** The IP counter as the attempt left it. */
  ipAfter: AttemptState;
}

export type Admission =
  | { admitted: false; remainingSeconds: number }
  | { admitted: true; reservation: Reservation };

const counterColumns = {
  failures: loginAttempt.failures,
  windowExpiresAt: loginAttempt.windowExpiresAt,
  lockedUntil: loginAttempt.lockedUntil,
  lockoutLevel: loginAttempt.lockoutLevel,
};

async function readCounter(tx: Transaction, key: string): Promise<AttemptState | undefined> {
  const [row] = await tx
    .select(counterColumns)
    .from(loginAttempt)
    .where(eq(loginAttempt.attemptKey, key));
  return row;
}

/**
 * Lets one attempt through, or refuses it because the pair or the IP is
 * locked. Counts the attempt against both counters when it is let through;
 * a refused attempt counts for nothing, so hammering a lock neither extends
 * it nor climbs to a longer step.
 *
 * The delete is housekeeping that rides along: a row past both its window
 * and its lock can no longer affect any decision, so it goes in the same
 * transaction. No cron, and the table holds only what's still live.
 *
 * `now` is passed in rather than read here, so tests can move the clock.
 * Throws when the database can't be written; callers refuse the attempt in
 * that case (fail closed), never let it through uncounted.
 */
export async function admitAttempt(
  pair: AttemptCounter,
  ip: AttemptCounter,
  now: number,
): Promise<Admission> {
  return serializedWrite(() =>
    getDb().transaction(async (tx): Promise<Admission> => {
      await tx
        .delete(loginAttempt)
        .where(and(lte(loginAttempt.windowExpiresAt, now), lte(loginAttempt.lockedUntil, now)));

      const pairRow = await readCounter(tx, pair.key);
      const ipRow = await readCounter(tx, ip.key);
      const remainingSeconds = Math.max(
        lockoutRemainingSeconds(pairRow, now),
        lockoutRemainingSeconds(ipRow, now),
      );
      if (remainingSeconds > 0) return { admitted: false, remainingSeconds };

      const pairAfter = nextAttemptState(pairRow, now, pair.limit);
      const ipAfter = nextAttemptState(ipRow, now, ip.limit);
      for (const [key, next] of [
        [pair.key, pairAfter],
        [ip.key, ipAfter],
      ] as const) {
        await tx
          .insert(loginAttempt)
          .values({ attemptKey: key, ...next })
          .onConflictDoUpdate({ target: loginAttempt.attemptKey, set: next });
      }
      return {
        admitted: true,
        reservation: {
          pairKey: pair.key,
          ipKey: ip.key,
          ipBefore: liveState(ipRow, now),
          ipAfter,
        },
      };
    }),
  );
}

/**
 * The right password was given: forgets the (identifier, IP) counter and
 * gives back the attempt the IP counter was charged, so a success leaves the
 * IP counter where it was (one address can't reset it by getting one account
 * in, and a real login doesn't use up its budget either).
 *
 * If nothing else has touched the IP counter since the attempt was counted
 * (the usual case), it goes back to exactly its earlier state, which also
 * undoes a lockout this very attempt started. If another attempt has moved
 * it meanwhile, it just loses one count.
 */
export async function settleSuccess(reservation: Reservation): Promise<void> {
  const { pairKey, ipKey, ipBefore, ipAfter } = reservation;
  await serializedWrite(() =>
    getDb().transaction(async (tx) => {
      await tx.delete(loginAttempt).where(eq(loginAttempt.attemptKey, pairKey));

      const row = await readCounter(tx, ipKey);
      if (!row) return;
      const untouched =
        row.failures === ipAfter.failures &&
        row.windowExpiresAt === ipAfter.windowExpiresAt &&
        row.lockedUntil === ipAfter.lockedUntil &&
        row.lockoutLevel === ipAfter.lockoutLevel;
      if (untouched && ipBefore.windowExpiresAt === 0) {
        // The attempt created the counter; there was nothing before it.
        await tx.delete(loginAttempt).where(eq(loginAttempt.attemptKey, ipKey));
      } else {
        const back = untouched ? ipBefore : { ...row, failures: Math.max(0, row.failures - 1) };
        await tx.update(loginAttempt).set(back).where(eq(loginAttempt.attemptKey, ipKey));
      }
    }),
  );
}

// Two layers keep a burst from failing writes that should simply wait.
//
// 1. A queue inside this process. @libsql/client holds one connection per
//    open transaction and gives up with TRANSACTION_ACTIVE past 20 at once
//    (and a local file gives SQLITE_BUSY to a second writer, as it has no
//    busy timeout). One serverless instance can see a burst of requests, so
//    the limiter's few-millisecond transactions line up here instead of
//    each taking a connection. Nothing is lost by it: the database would
//    serialise them anyway.
// 2. A retry on SQLITE_BUSY, for writers in *other* instances (Turso answers
//    the same way when writes land in the same instant). Retrying is safe:
//    a failed transaction has rolled back entirely and the callback
//    re-reads the rows it writes.
//
// If a write still won't go through, the error propagates and the caller
// refuses the attempt rather than letting it pass uncounted.
const BUSY_RETRIES = 12;

let queue: Promise<unknown> = Promise.resolve();

function serializedWrite<T>(write: () => Promise<T>): Promise<T> {
  const run = async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await write();
      } catch (error) {
        if (attempt >= BUSY_RETRIES || !isBusy(error)) throw error;
        // A short, jittered backoff so writers in different instances don't
        // collide again in lockstep.
        await wait(2 * (attempt + 1) + Math.random() * 10);
      }
    }
  };
  const result = queue.then(run, run);
  // A failed write mustn't break the queue for the ones behind it.
  queue = result.catch(() => {});
  return result;
}

/** Whether the database turned the write away because another held the lock. */
function isBusy(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  const causeCode = (error as { cause?: { code?: unknown } } | null)?.cause?.code;
  return (
    code === "SQLITE_BUSY" ||
    causeCode === "SQLITE_BUSY" ||
    (error instanceof Error && error.message.includes("SQLITE_BUSY"))
  );
}
