import "server-only";
import { hashPassword, verifyPassword } from "@/auth/password";
import { loginPath } from "@/auth/safe-next-path";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/data/limits";
import { getReviewerCredentialsById, setReviewerPasswordHash, type Reviewer } from "@/data/reviewers";

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