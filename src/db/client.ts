import "server-only";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { databaseConnection } from "@/db/connection";
import * as schema from "@/db/schema";

export type Database = LibSQLDatabase<typeof schema>;

let db: Database | undefined;

/**
 * The shared Drizzle client. Created on first use, not at import, so
 * `next build` and visitors' page views never need DATABASE_URL: only code
 * that actually queries does.
 */
export function getDb(): Database {
  db ??= drizzle(createClient(databaseConnection()), { schema });
  return db;
}
