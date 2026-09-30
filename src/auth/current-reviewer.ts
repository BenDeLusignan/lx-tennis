import "server-only";
import { cache } from "react";
import { passwordFingerprint, readSession } from "@/auth/session";
import { getReviewerCredentialsById, type Reviewer } from "@/data/reviewers";

/**
 * The logged-in reviewer, or null for a visitor. This is the security
 * boundary: anything that writes data (the Server Actions in each area's
 * `actions.ts`) must call it on the server and refuse when it returns null.
 * Hiding UI from visitors is only cosmetic.
 *
 * Reads the session cookie, so the calling component renders at request
 * time: keep it behind a <Suspense> boundary so the rest of the page stays
 * in the static shell. `cache` makes repeat calls in one request free.
 */
export const getCurrentReviewer = cache(async (): Promise<Reviewer | null> => {
  const session = await readSession();
  if (!session) return null;

  const reviewer = await getReviewerCredentialsById(session.sub);
  // A deleted reviewer, or a password reset since this session started.
  if (!reviewer?.passwordHash || passwordFingerprint(reviewer.passwordHash) !== session.pwd) {
    return null;
  }
  return { id: reviewer.id, username: reviewer.username, displayName: reviewer.displayName };
});
