/**
 * For tests only. Import it FIRST in a test file, before anything from
 * `src/data`: it has to swap `next/cache` and set DATABASE_URL before those
 * modules load.
 *
 * - `next/cache`: `cacheTag`/`cacheLife` only work inside Next's `'use cache'`
 *   and `updateTag` only inside a Server Action; outside Next they throw.
 *   Here they're stand-ins, and `refreshedTags` records every `updateTag`,
 *   so a test can check that a save refreshes the right pages.
 * - The database: a new file with every migration in `drizzle/` applied,
 *   used through the app's own `getDb()`, never local.db. One per test file
 *   (each file runs in its own process), shared by its tests, so tests use
 *   their own dates or strings to stay out of each other's way.
 *
 * Needs `--experimental-test-module-mocks`, which `npm test` passes.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, mock, type MockModuleOptions } from "node:test";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
// getDb reads DATABASE_URL on first use, not at import, so the order is safe.
import { closeDb, getDb } from "@/db/client";
import { removeTestDir } from "@/db/remove-test-dir";
import { loginAttempt } from "@/db/schema";

export const refreshedTags: string[] = [];

// `exports` is Node 26's name for the option; @types/node 20 only knows the
// deprecated `namedExports`, hence the cast.
mock.module("next/cache", {
  exports: {
    cacheTag: () => {},
    cacheLife: () => {},
    updateTag: (tag: string) => {
      refreshedTags.push(tag);
    },
  },
} as MockModuleOptions);

const dir = mkdtempSync(path.join(tmpdir(), "lx-tennis-data-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
// Close the client first: the file stays locked while it's open, and
// removeTestDir explains why closing alone doesn't free it on Windows.
after(async () => {
  closeDb();
  await removeTestDir(dir);
});

before(async () => {
  await migrate(getDb(), { migrationsFolder: path.join(process.cwd(), "drizzle") });
});

/** Empties `refreshedTags`, so a test sees only its own refreshes. */
export function clearRefreshedTags(): void {
  refreshedTags.length = 0;
}

/** The limiter's stored counter for a hashed key, or undefined when there's no row. */
export async function attemptRow(key: string) {
  const [row] = await getDb().select().from(loginAttempt).where(eq(loginAttempt.attemptKey, key));
  return row;
}
