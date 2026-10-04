"use server";

import { redirect } from "next/navigation";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { verifyPassword } from "@/auth/password";
import { safeNextPath } from "@/auth/safe-next-path";
import { endSession, startSession } from "@/auth/session";
import { submitPasswordChange } from "@/auth/submit";
import { PASSWORD_MAX_LENGTH } from "@/data/limits";
import { getReviewerCredentialsById, getReviewerCredentialsByUsername } from "@/data/reviewers";

// Both actions always end in redirect(), never by returning to render the
// page. A form posted before the page's JavaScript has loaded is a plain
// HTML POST: redirect() answers it with a 303 to a full page, whereas a
// render would answer with only the streamed part of the page (no <html>,
// no CSS), which shows as a blank screen.

// Server Actions are public POST endpoints: bound what anyone can make
// scrypt chew on. No real username or password comes near these.
const MAX_USERNAME_LENGTH = 64;

export async function logIn(formData: FormData): Promise<never> {
  // Re-checked here, not trusted from the page: the hidden field is user input.
  const next = safeNextPath(formData.get("next"));
  const username = formData.get("username");
  const password = formData.get("password");

  if (
    typeof username === "string" &&
    typeof password === "string" &&
    username.length <= MAX_USERNAME_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH
  ) {
    const reviewer = await getReviewerCredentialsByUsername(username);
    // Always runs scrypt, even for an unknown username, so response time
    // doesn't give away which usernames exist.
    const passwordMatches = await verifyPassword(password, reviewer?.passwordHash ?? null);
    if (reviewer?.passwordHash && passwordMatches) {
      await startSession({ id: reviewer.id, passwordHash: reviewer.passwordHash });
      redirect(next);
    }
  }

  // Every failure gets the same flag, so the page shows one generic message
  // and never reveals which usernames exist. The username isn't put in the
  // URL: people sometimes type their password into that field by mistake.
  const params = new URLSearchParams({ failed: "1" });
  if (next !== "/") params.set("next", next);
  redirect(`/login?${params}`);
}

// POST only (a Server Action), so a link or an <img> on another site can't
// log a reviewer out. Always lands on the home page (Ben's call), where the
// header's switch back to "Log in" shows it worked.
export async function logOut(): Promise<never> {
  await endSession();
  redirect("/");
}

/**
 * Changes the logged-in reviewer's password. The submit function refuses a
 * visitor and every bad input; on success this re-issues the session cookie
 * against the new hash, so the device that made the change stays logged in
 * while every other device is logged out (their cookie's password
 * fingerprint no longer matches getCurrentReviewer).
 */
export async function changePassword(formData: FormData): Promise<never> {
  const reviewer = await getCurrentReviewer();
  const result = await submitPasswordChange(reviewer, formData);
  if (result.changed && reviewer) {
    // The new hash is in the database now; the fresh cookie must carry its
    // fingerprint, or this request's next page read would be logged out too.
    const credentials = await getReviewerCredentialsById(reviewer.id);
    if (credentials?.passwordHash) {
      await startSession({ id: credentials.id, passwordHash: credentials.passwordHash });
    }
  }
  redirect(result.redirect);
}
