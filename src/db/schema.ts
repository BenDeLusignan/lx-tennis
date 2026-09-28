/**
 * Database schema (Drizzle). Only `src/data` and the tooling
 * (`drizzle.config.ts`) import `src/db`; pages and scripts go through
 * `src/data`.
 *
 * After changing a table here, run `npm run db:generate` to write the SQL
 * migration into `drizzle/`, and commit both together.
 */
import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * The people who can log in: Ben, Michal and Otavio, seeded by the
 * `0001_seed_reviewers` migration. Reviews will reference `id`, which is why
 * it's a separate key from `username`: a username can change without
 * breaking those links.
 */
export const reviewer = sqliteTable(
  "reviewer",
  {
    // AUTOINCREMENT so an id is never reused, even after a row is deleted.
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull().unique(),
    displayName: text("display_name").notNull(),
    /**
     * `scrypt$N$r$p$salt$hash` from `src/auth/password.ts`. Null until
     * `npm run db:set-password` sets it; a null hash can never log in.
     */
    passwordHash: text("password_hash"),
  },
  (table) => [
    // Login lowercases what's typed (phones capitalise the first letter), so
    // a stored capital would make that account impossible to log in to.
    check("reviewer_username_lowercase", sql`${table.username} = lower(${table.username})`),
    // The header shows this name; an empty one would leave just "Log out".
    check("reviewer_display_name_not_blank", sql`length(trim(${table.displayName})) > 0`),
  ],
);
