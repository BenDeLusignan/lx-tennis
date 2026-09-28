import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { reviewer } from "@/db/schema";

/**
 * Reviewer accounts. The `...Credentials` accessors return the password hash
 * and exist only for `src/auth` and `scripts/set-password.ts`; pages and
 * components get a `Reviewer`, which never carries it.
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
 * Usernames are stored lowercase (the table has a CHECK for it) and matched
 * case-insensitively, because phone keyboards capitalise the first letter.
 */
function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
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
    .where(eq(reviewer.username, normalizeUsername(username)));
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
    .where(eq(reviewer.username, normalizeUsername(username)))
    .returning({ id: reviewer.id });
  return updated.length > 0;
}

export async function getReviewerUsernames(): Promise<string[]> {
  const rows = await getDb()
    .select({ username: reviewer.username })
    .from(reviewer)
    .orderBy(reviewer.id);
  return rows.map((row) => row.username);
}
