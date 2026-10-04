import "server-only";
import { secretHmac } from "@/auth/secret";
import type { AttemptCounter } from "@/data/attempts";
import { IP_FAILURE_LIMIT, LOGIN_FAILURE_LIMIT } from "@/data/limits";

/**
 * The limiter's keys, and the limits that go with them.
 *
 * Each key is an HMAC of what it stands for, keyed by SESSION_SECRET, so the
 * `login_attempt` table holds no email address and no IP address: a database
 * leak exposes neither. The prefix keeps a login key, a reviewer key and an
 * IP key apart, so one can't be read as another. If SESSION_SECRET changes
 * every key changes with it: the old rows are never matched again (and are
 * swept once they expire), so all counters and lockouts start afresh. That's
 * acceptable: changing it already logs everyone out.
 *
 * An (identifier, IP) pair is what stops a stranger who doesn't know a
 * reviewer's email from locking that reviewer out: their failures land on
 * (that identifier, their IP), and the reviewer's own address is a different
 * key. The IP counter is shared by every identifier and every form, so one
 * address spraying many accounts hits it, at `IP_FAILURE_LIMIT`.
 */

/**
 * What an absent IP (local development, no trusted header) becomes. Every
 * such request shares one bucket: coarser than real per-IP keying, but on
 * Vercel the header is always there, and a request without one can only ever
 * lock out other requests without one, never a reviewer who has an address.
 */
const NO_IP = "unknown";

export interface AttemptKeys {
  /** (identifier, IP): wrong passwords for one account from one address. */
  pair: AttemptCounter;
  /** IP alone: attempts across every identifier from one address. */
  ip: AttemptCounter;
}

function keys(pairValue: string, ip: string | null): AttemptKeys {
  const address = ip ?? NO_IP;
  return {
    pair: { key: secretHmac("attempt", `${pairValue}|${address}`), limit: LOGIN_FAILURE_LIMIT },
    ip: { key: secretHmac("attempt", `ip:${address}`), limit: IP_FAILURE_LIMIT },
  };
}

/** Keys for a login attempt: the typed identifier (username or email) and the IP. */
export function loginAttemptKeys(identifier: string, ip: string | null): AttemptKeys {
  return keys(`login:${identifier.trim().toLowerCase()}`, ip);
}

/**
 * Keys for a current-password check by a logged-in reviewer (change
 * password, email). Keyed by reviewer id rather than the identifier they
 * typed, because nothing was typed: the reviewer comes from the session.
 * Both forms share it, so they share one budget of wrong passwords.
 */
export function reviewerAttemptKeys(reviewerId: number, ip: string | null): AttemptKeys {
  return keys(`reviewer:${reviewerId}`, ip);
}
