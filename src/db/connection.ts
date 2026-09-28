/**
 * Where the database is, read from the environment. Shared by the app
 * (`src/db/client.ts`), the migration tool (`drizzle.config.ts`) and the
 * scripts in `scripts/`, so all three always talk to the same database.
 *
 * The URL decides the backend, so moving to Turso is a config change:
 *   file:local.db                  local SQLite file (development)
 *   libsql://<db>.turso.io         Turso, with DATABASE_AUTH_TOKEN set
 */
export function databaseConnection(): { url: string; authToken?: string } {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local (see README).");
  }
  // An empty DATABASE_AUTH_TOKEN= line in .env.local means "no token".
  const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;
  return { url, authToken };
}
