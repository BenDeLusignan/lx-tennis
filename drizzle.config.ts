import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";
import { databaseConnection } from "./src/db/connection";

// Same .env files, same precedence as `next dev`, so `npm run db:migrate`
// migrates the database the app uses.
loadEnvConfig(process.cwd());

export default defineConfig({
  // "turso" is drizzle-kit's libSQL dialect: it accepts both `file:` URLs
  // and hosted Turso URLs, matching the app's driver (@libsql/client).
  dialect: "turso",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: databaseConnection(),
  strict: true,
});
