"use server";

import { redirect } from "next/navigation";
import { clientIp } from "@/auth/client-ip";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { endSession, startSession } from "@/auth/session";
import { submitEmailChange, submitLogin, submitPasswordChange } from "@/auth/submit";
import { getReviewerCredentialsById } from "@/data/reviewers";

// Both actions always end in redirect(), never by returning to render the
// page. A form posted before the page's JavaScript has loaded is a plain
// HTML POST: redirect() answers it with a 303 to a full page, whereas a
// render would answer with only the streamed part of the page (no <html>,
// no CSS), which shows as a blank screen.

// The clock and the client's IP are read here and passed in, so the submit
// functions can be tested with a fixed time and address. `clientIp` reads
// the request headers (see it for which one is trusted, and why).
export async function logIn(formData: FormData): Promise<never> {
  const result = await submitLogin(formData, {
    now: Math.floor(Date.now() / 1000),
    ip: await clientIp(),
  });
  // Start the session only once the credentials are known to be right: the
  // cookie can only be set from an action, so the submit function returns
  // what to sign rather than signing it itself.
  if (result.session) await startSession(result.session);
  redirect(result.redirect);
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
  const result = await submitPasswordChange(reviewer, formData, {
    now: Math.floor(Date.now() / 1000),
    ip: await clientIp(),
  });
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

/**
 * Sets or changes the logged-in reviewer's own email. Unlike a password
 * change it doesn't touch the session: the session is bound to the hash,
 * not the email, so every device stays logged in.
 */
export async function changeEmail(formData: FormData): Promise<never> {
  const reviewer = await getCurrentReviewer();
  const result = await submitEmailChange(reviewer, formData, {
    now: Math.floor(Date.now() / 1000),
    ip: await clientIp(),
  });
  redirect(result.redirect);
}
