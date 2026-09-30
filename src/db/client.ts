import "server-only";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { databaseConnection } from "@/db/connection";
import * as schema from "@/db/schema";

export type Database = LibSQLDatabase<typeof schema>;

/**
 * What `getDb().transaction()` hands its callback. @libsql/client opens it
 * as a write transaction (`BEGIN IMMEDIATE`), so writers queue up and a
 * check made inside one (a duplicate, a string in use) still holds when the
 * write that follows it lands.
 */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

let db: Database | undefined;

/**
 * The shared Drizzle client. Created on first use, not at import, so only
 * code that actually queries needs DATABASE_URL. That includes `next build`:
 * it prerenders each racquet page's setup cards from the database.
 *
 * @libsql/client turns SQLite's foreign-key enforcement on for every
 * connection (plain SQLite leaves it off), which the schema's RESTRICT rules
 * depend on; `src/db/schema.test.ts` fails if that ever stops being true.
 */
export function getDb(): Database {
  db ??= drizzle(createClient(databaseConnection()), { schema });
  return db;
}
