import "server-only";
import { hashPassword, verifyPassword } from "@/auth/password";
import { loginPath } from "@/auth/safe-next-path";
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/data/limits";
import {
  getReviewerCredentialsById,
  getReviewerEmail,
  setReviewerEmail,
  setReviewerPasswordHash,
  type Reviewer,
} from "@/data/reviewers";
import { parseEmail } from "@/forms/fields";

/**
 * What the changePassword Server Action (`src/auth/actions.ts`) does, given
 * the logged-in reviewer (null for a visitor). Returns where to redirect:
 * the login page for a visitor, otherwise /account with `?changed=1` or an
 * `?error=<flag>`. Nothing is written until every check has passed.
 *
 * The current-password check is the same constant-time verify as login, so
 * an attempt costs one full scrypt run and a wrong guess changes nothing.
 */

export interface PasswordChangeResult {
  /** The URL the action redirects to. */
  redirect: string;
  /** Whether the password actually changed; the action re-issues the session when true. */
  changed: boolean;
}

/** The refusal codes `?error=` can carry, each with its own message on /account. */
export type PasswordChangeError = "current" | "short" | "mismatch" | "same" | "invalid";

export async function submitPasswordChange(
  reviewer: Reviewer | null,
  formData: FormData,
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

  const credentials = await getReviewerCredentialsById(reviewer.id);
  // Always one full scrypt run, even for an account with no stored hash, so
  // the response time doesn't give away that its password was never set.
  const currentMatches = await verifyPassword(current, credentials?.passwordHash ?? null);
  if (!credentials?.passwordHash || !currentMatches) return refused("current");

  if (next.length < PASSWORD_MIN_LENGTH) return refused("short");
  if (next !== confirm) return refused("mismatch");
  if (next === current) return refused("same");

  await setReviewerPasswordHash(reviewer.username, await hashPassword(next));
  return { redirect: "/account?changed=1", changed: true };
}

function refused(flag: PasswordChangeError): PasswordChangeResult {
  return { redirect: `/account?error=${flag}`, changed: false };
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
export type EmailChangeError = "email-invalid" | "email-current" | "email-used" | "email-same";

/**
 * What the changeEmail Server Action (`src/auth/actions.ts`) does, given
 * the logged-in reviewer (null for a visitor). Returns where to redirect:
 * the login page for a visitor, otherwise /account with `?saved=1` or an
 * `?error=<flag>`. Nothing is written until every check has passed.
 *
 * Why the current password is required: the email will later be the way to
 * reset a forgotten password (docs/vision.md, Open questions), so anyone
 * who can change it can take over the account. A stolen logged-in session
 * alone must not be enough. The check is the same constant-time verify as
 * login and change-password, so a guess costs a full scrypt run.
 *
 * The password is verified before the email is even looked at, so a wrong
 * password never reveals whether an address is in use.
 */
export async function submitEmailChange(
  reviewer: Reviewer | null,
  formData: FormData,
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

  const credentials = await getReviewerCredentialsById(reviewer.id);
  // Always one full scrypt run, even for an account with no stored hash,
  // so the response time doesn't give away that its password was never set.
  const currentMatches = await verifyPassword(current, credentials?.passwordHash ?? null);
  if (!credentials?.passwordHash || !currentMatches) return emailRefused("email-current");

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