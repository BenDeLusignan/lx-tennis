import { LOCKOUT_STEPS_MINUTES } from "@/data/limits";

/**
 * The message for a limiter refusal, shared by the login page (`?locked=`)
 * and the account page's forms (`?wait=`), so the parsing and wording live in
 * one place. Pure (no `server-only`), so a test can import it directly.
 *
 * `wait` comes from the URL, which anyone can hand-make, so it's only
 * believed when it's a plain positive whole number no longer than the longest
 * real lockout (`15`). Anything else ("99999", "1e3", "-1", "abc", a repeated
 * parameter) falls back to "a few minutes" rather than printing an absurd
 * wait. `0` is what the actions send when the limiter couldn't be written at
 * all, which is an outage, not a lockout, so it says so.
 *
 * Neither reveals anything about accounts: the minutes come from the
 * requester's own counters, which count known and unknown emails alike.
 */
const LONGEST_LOCKOUT_MINUTES = Math.max(...LOCKOUT_STEPS_MINUTES);

// A no-break space, so "15 minutes" can't wrap between the number and its unit.
const NBSP = "\u00a0";

export function lockoutMessage(wait: string | string[] | undefined): string {
  if (wait === "0") return "We couldn’t check your details right now. Try again in a few minutes.";

  const minutes = typeof wait === "string" && /^[1-9]\d{0,2}$/.test(wait) ? Number(wait) : NaN;
  if (!(minutes <= LONGEST_LOCKOUT_MINUTES)) return "Too many attempts. Try again in a few minutes.";
  return `Too many attempts. Try again in ${minutes}${NBSP}minute${minutes === 1 ? "" : "s"}.`;
}
