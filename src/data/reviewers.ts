import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { getDb, type Transaction } from "@/db/client";
import { reviewer } from "@/db/schema";

/**
 * Reviewer accounts. The `...Credentials` accessors return the password hash
 * and exist only for `src/auth` and `scripts/set-password.ts`; pages and
 * components get a `Reviewer`, which never carries it — nor the email,
 * which is read only via `getReviewerEmail` (see `getReviewers` below).
 */

export interface Reviewer {
  id: number;
  username: string;
  displayName: string;
}

export interface ReviewerCredentials extends Reviewer {
  /** Null until a password has been set with `npm run db:set-password`. */
  passwordHash: string | null;
}

/**
 * Usernames and email addresses are both stored lowercase, and both are
 * matched case-insensitively because phone keyboards capitalise the first
 * letter.
 */
function normalizeLower(value: string): string {
  return value.trim().toLowerCase();
}

const credentialsColumns = {
  id: reviewer.id,
  username: reviewer.username,
  displayName: reviewer.displayName,
  passwordHash: reviewer.passwordHash,
};

export async function getReviewerCredentialsByUsername(
  username: string,
): Promise<ReviewerCredentials | undefined> {
  const [row] = await getDb()
    .select(credentialsColumns)
    .from(reviewer)
    .where(eq(reviewer.username, normalizeLower(username)));
  return row;
}

/**
 * A reviewer's credentials by the email address typed in the login form.
 * Log in is by email only: usernames are public, so they never identify a
 * login. Emails are stored lowercase (the unique index folds case), and the
 * input is trimmed and lowercased here, so a plain compare finds the row. A
 * username, or any text that isn't a stored address, finds nothing.
 *
 * Not cached, and the select spells out its columns: no email rides out of
 * here, and nothing here reaches a prerendered page.
 */
export async function getReviewerCredentialsByEmail(
  email: string,
): Promise<ReviewerCredentials | undefined> {
  const [row] = await getDb()
    .select(credentialsColumns)
    .from(reviewer)
    .where(eq(reviewer.email, normalizeLower(email)));
  return row;
}

export async function getReviewerCredentialsById(
  id: number,
): Promise<ReviewerCredentials | undefined> {
  const [row] = await getDb().select(credentialsColumns).from(reviewer).where(eq(reviewer.id, id));
  return row;
}

/** Returns false when no reviewer has that username. */
export async function setReviewerPasswordHash(
  username: string,
  passwordHash: string,
): Promise<boolean> {
  const updated = await getDb()
    .update(reviewer)
    .set({ passwordHash })
    .where(eq(reviewer.username, normalizeLower(username)))
    .returning({ id: reviewer.id });
  return updated.length > 0;
}

/**
 * The reviewer's stored email, or null when they've never set one. Read
 * separately from `Reviewer` on purpose: an email is private, so it never
 * rides on a reviewer object — `getReviewers()` feeds the public score
 * grid, and the account page's `Reviewer` is passed around pages. Not
 * cached: the account page reads it per request, after the session check.
 */
export async function getReviewerEmail(reviewerId: number): Promise<string | null> {
  const [row] = await getDb()
    .select({ email: reviewer.email })
    .from(reviewer)
    .where(eq(reviewer.id, reviewerId));
  return row?.email ?? null;
}

/**
 * Whether some other reviewer already has this email. Stored values are
 * already lowercased and trimmed (the submit canonicalises its input), so a
 * plain compare matches them; called inside `setReviewerEmail`'s write
 * transaction for the same reason `findStringByName` is, so a check made
 * here still holds when the write that follows it lands.
 */
export async function reviewerEmailInUse(
  tx: Transaction,
  email: string,
  reviewerId: number,
): Promise<boolean> {
  const [row] = await tx
    .select({ id: reviewer.id })
    .from(reviewer)
    .where(and(eq(reviewer.email, email), ne(reviewer.id, reviewerId)));
  return row !== undefined;
}

/**
 * Sets the reviewer's own email, refused when another reviewer already has
 * it. The unique index in the schema stays as the backstop for a check
 * bypassed here. Nothing cached shows an email (`getReviewers` selects
 * without it and has no tag), so there's nothing to refresh. Only from a
 * Server Action.
 */
export async function setReviewerEmail(
  reviewerId: number,
  email: string,
): Promise<"saved" | "not-found" | "email-used"> {
  return getDb().transaction(async (tx) => {
    if (await reviewerEmailInUse(tx, email, reviewerId)) return "email-used";
    const updated = await tx
      .update(reviewer)
      .set({ email })
      .where(eq(reviewer.id, reviewerId))
      .returning({ id: reviewer.id });
    return updated.length > 0 ? "saved" : "not-found";
  });
}

export async function getReviewerUsernames(): Promise<string[]> {
  const rows = await getDb()
    .select({ username: reviewer.username })
    .from(reviewer)
    .orderBy(reviewer.id);
  return rows.map((row) => row.username);
}

/**
 * Every reviewer, by id: the score grid's column order. Cached into the
 * static shell with no tag, because nothing in the app changes a reviewer's
 * id or name (the password hash changes via `db:set-password` or the
 * account page's change-password form, and isn't here). A reviewer added by
 * a migration shows up after the next build, whose new build id starts
 * every cache afresh.
 *
 * The select spells out its columns on purpose: this result is baked into
 * prerendered pages, so a future `select()` of the whole row would leak the
 * `email` column into the public grid. Emails are read only through
 * `getReviewerEmail`, per request, never cached.
 */
export async function getReviewers(): Promise<readonly Reviewer[]> {
  "use cache";
  cacheLife("max");
  return getDb()
    .select({ id: reviewer.id, username: reviewer.username, displayName: reviewer.displayName })
    .from(reviewer)
    .orderBy(reviewer.id);
}
