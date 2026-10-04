import "server-only";
import { loginAttemptKeys, reviewerAttemptKeys, type AttemptKeys } from "@/auth/attempt-keys";
import { hashPassword, verifyPassword } from "@/auth/password";
import { loginPath, safeNextPath } from "@/auth/safe-next-path";
import { admitAttempt, settleSuccess, type Reservation } from "@/data/attempts";
import { lockoutWaitMinutes } from "@/data/attempt-rules";
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/data/limits";
import {
  getReviewerCredentialsById,
  getReviewerCredentialsByEmail,
  getReviewerEmail,
  setReviewerEmail,
  setReviewerPasswordHash,
  type Reviewer,
} from "@/data/reviewers";
import { parseEmail } from "@/forms/fields";

/**
 * What a submit function needs to run the failed-attempt limiter. Both are
 * passed in rather than read here: the Server Action reads the real clock
 * and the request's headers, and a test moves the clock and names the
 * addresses itself, with no sleeping and no invented request headers.
 */
export interface AttemptContext {
  /** Unix seconds. */
  now: number;
  /** The client's address (`clientIp`), or null when no trusted header carried one. */
  ip: string | null;
}

/**
 * The limiter's gate in front of every password check (login, change
 * password, email). Either the attempt is admitted, and has been counted
 * already, or it's refused: `minutes` is the wait for a lockout, or null
 * when the counters couldn't be written.
 *
 * A refused attempt never reaches `verifyPassword`: while locked, even the
 * right password must not get through, or a guesser would learn when they
 * hit it. And a limiter that can't be written fails closed: the attempt is
 * refused, never let through uncounted.
 */
async function admit(
  keys: AttemptKeys,
  now: number,
): Promise<{ admitted: true; reservation: Reservation } | { admitted: false; minutes: number | null }> {
  try {
    const admission = await admitAttempt(keys.pair, keys.ip, now);
    if (admission.admitted) return admission;
    return { admitted: false, minutes: lockoutWaitMinutes(admission.remainingSeconds) };
  } catch {
    return { admitted: false, minutes: null };
  }
}

/**
 * The right password was given: forget the (typed email, IP) counter and give
 * back the attempt the IP counter was charged. If that write fails the
 * attempt still counts as made, which is the safe side (a little less
 * headroom, never more), and a correct password isn't turned away for it.
 */
async function settle(reservation: Reservation): Promise<void> {
  try {
    await settleSuccess(reservation);
  } catch {
    // Nothing to do: the counters only ever err towards locking sooner.
  }
}

/** What the logIn action should do next. */
export interface LoginResult {
  /** Where to go: the page in `?next=`, or /login with a flag. */
  redirect: string;
  /** Set when the credentials were right; the action starts the session. */
  session?: { id: number; passwordHash: string };
}

/**
 * What the logIn Server Action (`src/auth/actions.ts`) does, given the
 * posted form and the request's clock and IP. Returns where to redirect and,
 * on success, the session to start.
 *
 * An unknown email, a username typed in its place, a wrong password and a
 * reviewer with no password are indistinguishable: all get the same
 * `?failed=1` redirect, and all cost one full scrypt run (`verifyPassword`
 * runs the same scrypt against nothing when there's no stored hash, so an
 * unknown email isn't the cheap one). They're also counted the same way,
 * before the email is even looked up, so a lockout never says whether an
 * account exists or whether what was typed is a valid username. The email
 * never reaches the URL.
 */
export async function submitLogin(formData: FormData, context: AttemptContext): Promise<LoginResult> {
  // Re-checked here, not trusted from the page: the hidden field is user input.
  const next = safeNextPath(formData.get("next"));
  // `unknown` until checked: a hand-made request can send anything. The
  // typed email is bounded before it's hashed into a limiter key, and the
  // password before scrypt sees it. Not validated as an address: anything
  // that isn't a stored email fails the same way and is counted the same way.
  const typed = formData.get("email");
  const email = (typeof typed === "string" ? typed : "").slice(0, EMAIL_MAX_LENGTH);
  const postedPassword = formData.get("password");
  const password =
    typeof postedPassword === "string" && postedPassword.length <= PASSWORD_MAX_LENGTH
      ? postedPassword
      : "";

  const gate = await admit(loginAttemptKeys(email, context.ip), context.now);
  if (!gate.admitted) return { redirect: lockedLoginPath(next, gate.minutes) };

  const reviewer = await getReviewerCredentialsByEmail(email);
  // Always runs scrypt, even for an unknown email or an account with no
  // stored hash, so response time doesn't give either away.
  const passwordMatches = await verifyPassword(password, reviewer?.passwordHash ?? null);

  // Every failure gets the same flag, so the page shows one generic message
  // and never reveals which emails exist. The email isn't put in
  // the URL: people sometimes type their password into that field by mistake.
  // The failure is already counted (see `admit`), so nothing more to record.
  if (!reviewer?.passwordHash || !passwordMatches) return { redirect: failedLoginPath(next) };

  await settle(gate.reservation);
  return { redirect: next, session: { id: reviewer.id, passwordHash: reviewer.passwordHash } };
}

function failedLoginPath(next: string): string {
  const params = new URLSearchParams({ failed: "1" });
  if (next !== "/") params.set("next", next);
  return `/login?${params}`;
}

/** `minutes` is null when the limiter couldn't be written: sent as 0, which the page words as an outage (`lockoutMessage`). */
function lockedLoginPath(next: string, minutes: number | null): string {
  const params = new URLSearchParams({ locked: String(minutes ?? 0) });
  if (next !== "/") params.set("next", next);
  return `/login?${params}`;
}

/**
 * What the changePassword Server Action (`src/auth/actions.ts`) does, given
 * the logged-in reviewer (null for a visitor). Returns where to redirect:
 * the login page for a visitor, otherwise /account with `?changed=1` or an
 * `?error=<flag>`. Nothing is written until every check has passed.
 *
 * The current-password check is the same constant-time verify as login, so
 * an attempt costs one full scrypt run and a wrong guess changes nothing. A
 * wrong current password also counts towards the limiter, keyed by reviewer
 * id and IP; nothing is verified while that key is locked.
 */

export interface PasswordChangeResult {
  /** The URL the action redirects to. */
  redirect: string;
  /** Whether the password actually changed; the action re-issues the session when true. */
  changed: boolean;
}

/** The refusal codes `?error=` can carry, each with its own message on /account. */
export type PasswordChangeError = "current" | "short" | "mismatch" | "same" | "invalid" | "locked";

export async function submitPasswordChange(
  reviewer: Reviewer | null,
  formData: FormData,
  context: AttemptContext,
): Promise<PasswordChangeResult> {
  if (!reviewer) return { redirect: loginPath("/account"), changed: false };

  // `unknown` until checked: a hand-made request can send anything. Lengths
  // are bounded before scrypt touches the strings.
  const current = formData.get("currentPassword");
  const next = formData.get("newPassword");
  const confirm = formData.get("confirmPassword");
  if (
    typeof current !== "string" ||
    typeof next !== "string" ||
    typeof confirm !== "string" ||
    current.length > PASSWORD_MAX_LENGTH ||
    next.length > PASSWORD_MAX_LENGTH ||
    confirm.length > PASSWORD_MAX_LENGTH
  ) {
    return refused("invalid");
  }

  const gate = await admit(reviewerAttemptKeys(reviewer.id, context.ip), context.now);
  if (!gate.admitted) return passwordLocked(gate.minutes);

  const credentials = await getReviewerCredentialsById(reviewer.id);
  // Always one full scrypt run, even for an account with no stored hash, so
  // the response time doesn't give away that its password was never set.
  const currentMatches = await verifyPassword(current, credentials?.passwordHash ?? null);
  // The failure is already counted (see `admit`).
  if (!credentials?.passwordHash || !currentMatches) return refused("current");

  // The current password was right, so this attempt isn't a failure.
  await settle(gate.reservation);

  if (next.length < PASSWORD_MIN_LENGTH) return refused("short");
  if (next !== confirm) return refused("mismatch");
  if (next === current) return refused("same");

  await setReviewerPasswordHash(reviewer.username, await hashPassword(next));
  return { redirect: "/account?changed=1", changed: true };
}

function refused(flag: PasswordChangeError): PasswordChangeResult {
  return { redirect: `/account?error=${flag}`, changed: false };
}

/** The locked refusal; `minutes` is null when the limiter couldn't be written (sent as `wait=0`). */
function passwordLocked(minutes: number | null): PasswordChangeResult {
  const wait = minutes ?? 0;
  return { redirect: `/account?error=locked&wait=${wait}`, changed: false };
}

export interface EmailChangeResult {
  /** The URL the action redirects to. */
  redirect: string;
  /** Whether the email actually changed. */
  saved: boolean;
}

/**
 * The refusal codes `?error=` can carry for the email form, each with its
 * own message on /account. Prefixed so they can't collide with the
 * change-password form's codes, which share the same `?error=` URL.
 */
export type EmailChangeError =
  | "email-invalid"
  | "email-current"
  | "email-used"
  | "email-same"
  | "email-locked";

/**
 * What the changeEmail Server Action (`src/auth/actions.ts`) does, given
 * the logged-in reviewer (null for a visitor). Returns where to redirect:
 * the login page for a visitor, otherwise /account with `?saved=1` or an
 * `?error=<flag>`. Nothing is written until every check has passed.
 *
 * Why the current password is required: the email is how the reviewer logs
 * in, and will later be the way to reset a forgotten password (docs/vision.md,
 * Open questions), so anyone who can change it can take over the account. A
 * stolen logged-in session alone must not be enough. The check is the same
 * constant-time verify as login and change-password, so a guess costs a full
 * scrypt run, and a wrong one counts towards the limiter, keyed by reviewer
 * id and IP.
 *
 * The password is verified before the email is even looked at, so a wrong
 * password never reveals whether an address is in use.
 */
export async function submitEmailChange(
  reviewer: Reviewer | null,
  formData: FormData,
  context: AttemptContext,
): Promise<EmailChangeResult> {
  if (!reviewer) return { redirect: loginPath("/account"), saved: false };

  // `unknown` until checked: a hand-made request can send anything. Lengths
  // are bounded before scrypt touches the strings.
  const emailInput = formData.get("email");
  const current = formData.get("currentPassword");
  if (
    typeof emailInput !== "string" ||
    typeof current !== "string" ||
    emailInput.length > EMAIL_MAX_LENGTH ||
    current.length > PASSWORD_MAX_LENGTH
  ) {
    return emailRefused("email-invalid");
  }

  const gate = await admit(reviewerAttemptKeys(reviewer.id, context.ip), context.now);
  if (!gate.admitted) return emailLocked(gate.minutes);

  const credentials = await getReviewerCredentialsById(reviewer.id);
  // Always one full scrypt run, even for an account with no stored hash,
  // so the response time doesn't give away that its password was never set.
  const currentMatches = await verifyPassword(current, credentials?.passwordHash ?? null);
  // The failure is already counted (see `admit`).
  if (!credentials?.passwordHash || !currentMatches) return emailRefused("email-current");

  await settle(gate.reservation);

  const email = parseEmail(emailInput);
  if (!email) return emailRefused("email-invalid");

  // Save the reviewer the round trip when they resubmit their own address.
  if (email === (await getReviewerEmail(reviewer.id))) return emailRefused("email-same");

  switch (await setReviewerEmail(reviewer.id, email)) {
    case "saved":
      return { redirect: "/account?saved=1", saved: true };
    case "email-used":
      return emailRefused("email-used");
    case "not-found":
      // The reviewer comes from the session, so this is a stale-session
      // edge; the same catch-all as a malformed form.
      return emailRefused("email-invalid");
  }
}

function emailRefused(flag: EmailChangeError): EmailChangeResult {
  return { redirect: `/account?error=${flag}`, saved: false };
}

/** The locked refusal; `minutes` is null when the limiter couldn't be written (sent as `wait=0`). */
function emailLocked(minutes: number | null): EmailChangeResult {
  const wait = minutes ?? 0;
  return { redirect: `/account?error=email-locked&wait=${wait}`, saved: false };
}
