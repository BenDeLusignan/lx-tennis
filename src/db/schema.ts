/**
 * Database schema (Drizzle). Only `src/data` and the tooling
 * (`drizzle.config.ts`) import `src/db`; pages and scripts go through
 * `src/data`.
 *
 * After changing a table here, run `npm run db:generate` to write the SQL
 * migration into `drizzle/`, and commit both together.
 *
 * Every id is AUTOINCREMENT so an id is never reused, even after a row is
 * deleted: a stale link can't end up pointing at a different row.
 */
import { sql, type SQL } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, unique, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * The people who can log in: Ben, Michal and Otavio, seeded by the
 * `0001_seed_reviewers` migration. Setups and reviews reference `id`, which
 * is why it's a separate key from `username`: a username can change without
 * breaking those links.
 */
export const reviewer = sqliteTable(
  "reviewer",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull().unique(),
    displayName: text("display_name").notNull(),
    /**
     * `scrypt$N$r$p$salt$hash` from `src/auth/password.ts`. Null until
     * `npm run db:set-password` sets it; a null hash can never log in.
     */
    passwordHash: text("password_hash"),
    /**
     * The reviewer's email, for a future password-reset link; null until
     * the reviewer sets one on /account. Private: no public reader ever
     * selects it (`getReviewers` spells out its columns), and the account
     * page reads it per request. Stored trimmed and lowercased (as
     * usernames are), so later a reset can look the address up as typed.
     */
    email: text("email"),
  },
  (table) => [
    // Login lowercases what's typed (phones capitalise the first letter), so
    // a stored capital would make that account impossible to log in to.
    check("reviewer_username_lowercase", sql`${table.username} = lower(${table.username})`),
    // The header shows this name; an empty one would leave just "Log out".
    // Plain trim() strips only spaces, so a name that's just a tab or newline
    // passes; unlike `trimWhitespace` below. It's in an applied migration
    // and SQLite can't alter a check, so fixing it needs a table rebuild.
    check("reviewer_display_name_not_blank", sql`length(trim(${table.displayName})) > 0`),
    // Like the string table's trimmed checks: " ben@x.com" stored raw would
    // dodge the unique index below (lower() keeps its space) and be a
    // second address. Plain trim() for the same reason as the name check.
    check("reviewer_email_trimmed", sql`${table.email} IS NULL OR ${table.email} = trim(${table.email})`),
    // The form enforces the same cap via EMAIL_MAX_LENGTH in
    // src/data/limits.ts; this pins it against a raw insert.
    check("reviewer_email_length", sql`${table.email} IS NULL OR length(${table.email}) <= 254`),
    // Case-insensitive, so "Ben@x.com" and "ben@x.com" are one address
    // (SQLite's lower() folds ASCII only, which covers the emails in play).
    // An email is stored lowercased and trimmed by the app; the index, not
    // a CHECK, is what stops a case variant sneaking past as a duplicate.
    // Multiple NULLs are fine: the seeded reviewers have no email yet.
    uniqueIndex("reviewer_email_unique").on(sql`lower(${table.email})`),
  ],
);

/** trim() on its own strips only spaces; a body of "\n" isn't a review either. */
function trimWhitespace(value: SQL): SQL {
  return sql`trim(${value}, ' ' || char(9, 10, 13))`;
}

/**
 * One row per racquet in `src/data/racquets.ts`, which keeps the specs,
 * photos and sources keyed by `slug`; setups reference `id`, so renaming a
 * slug can't break them. Seeded by the `0003_seed_racquets_and_strings`
 * migration. Adding a racquet to `src/data/racquets.ts` now also needs its
 * row here: a new migration that inserts the slug.
 */
export const racquet = sqliteTable(
  "racquet",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
  },
  (table) => [
    // It's a URL segment (`/racquets/[slug]`): lowercase letters, digits, hyphens.
    check(
      "racquet_slug_format",
      sql`length(${table.slug}) > 0 AND ${table.slug} NOT GLOB '*[^a-z0-9-]*'`,
    ),
  ],
);

/**
 * Product rule 14's string types, as stored. Stored value → label:
 * `polyester` → polyester, `co-polyester` → co-polyester,
 * `multifilament` → multifilament, `synthetic-gut` → synthetic gut,
 * `natural-gut` → natural gut, `kevlar-aramid` → Kevlar/aramid.
 * Changing this list needs a migration: the check below is written into it.
 */
export const STRING_TYPES = [
  "polyester",
  "co-polyester",
  "multifilament",
  "synthetic-gut",
  "natural-gut",
  "kevlar-aramid",
] as const;

/**
 * The shared string list (Product rule 14), seeded by the
 * `0003_seed_racquets_and_strings` migration with Ben's ten.
 */
export const string = sqliteTable(
  "string",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    brand: text("brand").notNull(),
    name: text("name").notNull(),
    type: text("type", { enum: STRING_TYPES }).notNull(),
  },
  (table) => [
    // Not blank, and no leading or trailing whitespace that would let
    // "Yonex " sneak past the unique index as a second Yonex.
    check(
      "string_brand_trimmed",
      sql`length(${table.brand}) > 0 AND ${table.brand} = ${trimWhitespace(sql`${table.brand}`)}`,
    ),
    check(
      "string_name_trimmed",
      sql`length(${table.name}) > 0 AND ${table.name} = ${trimWhitespace(sql`${table.name}`)}`,
    ),
    check(
      "string_type_valid",
      sql`${table.type} IN (${sql.raw(STRING_TYPES.map((type) => `'${type}'`).join(", "))})`,
    ),
    // Case-insensitive, so "Hyper-G" and "hyper-g" are the same string while
    // the manufacturer's own casing is what's stored and shown. SQLite's
    // lower() folds ASCII only, which covers these brand and string names.
    uniqueIndex("string_brand_name_unique").on(sql`lower(${table.brand})`, sql`lower(${table.name})`),
  ],
);

export const TENSION_UNITS = ["lb", "kg"] as const;

/**
 * The typed tension in tenths of the setup's unit, converted to tenths of a
 * kg (1 lb = 0.45359237 kg) and rounded half up. Tenths are exact integers,
 * so 55 lb (24.9476 kg) and 24.9 kg both give 249 and compare equal.
 * The float product can't land on a tie and round the wrong way: a tie
 * needs T × 45359237 ≡ 5×10⁷ (mod 10⁸), so T a multiple of 5⁸·2⁷, far
 * above the 800 (80.0 lb) the range check allows.
 *
 * Raw column names, not `${table.column}`: a generated column's expression
 * is built with the columns, before the table object exists to refer to.
 * `tension_unit` is hard-coded because every tension shares the setup's one
 * unit (Product rule 6).
 */
function kgTenths(tenthsColumn: string): SQL {
  return sql.raw(
    `CASE "tension_unit" WHEN 'kg' THEN "${tenthsColumn}" ` +
      `WHEN 'lb' THEN CAST(round("${tenthsColumn}" * 0.45359237) AS INTEGER) END`,
  );
}

/** 30–80 lb or 13.6–36.3 kg (Product rule 6), in tenths of the unit. */
function tensionInRange(tenths: SQL, unit: SQL): SQL {
  return sql`typeof(${tenths}) = 'integer' AND CASE ${unit}
    WHEN 'lb' THEN ${tenths} BETWEEN 300 AND 800
    WHEN 'kg' THEN ${tenths} BETWEEN 136 AND 363 END`;
}

/** A sanity range of 1.00–1.50 mm, in hundredths of a mm. */
function gaugeInRange(hundredths: SQL): SQL {
  return sql`typeof(${hundredths}) = 'integer' AND ${hundredths} BETWEEN 100 AND 150`;
}

/**
 * A stringing of a racquet (Product rule 1). Scores belong to a setup, not
 * to the racquet or string alone.
 *
 * Every setup has a string, gauge and tension for both the mains and the
 * crosses. Full bed or hybrid isn't stored: it's a full bed when the mains
 * and crosses have the same string and gauge. So one stringing has one row
 * shape, and can't be entered once as each kind.
 *
 * Numbers are stored as exact integers so equality is exact (a REAL 1.25 or
 * 24.9 isn't): gauges in hundredths of a mm (1.25 mm → 125) and tensions in
 * tenths of `tension_unit` (55.5 lb → 555), which is the number typed, in
 * the unit typed. `*_tension_tenths_kg` is generated by the database from
 * those, so it can never disagree with what was typed (Product rule 6).
 */
export const setup = sqliteTable(
  "setup",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    racquetId: integer("racquet_id")
      .notNull()
      .references(() => racquet.id, { onDelete: "restrict" }),
    /** YYYY-MM-DD, a real calendar date. */
    strungOn: text("strung_on").notNull(),
    tensionUnit: text("tension_unit", { enum: TENSION_UNITS }).notNull(),
    mainsStringId: integer("mains_string_id")
      .notNull()
      .references(() => string.id, { onDelete: "restrict" }),
    mainsGaugeHundredthsMm: integer("mains_gauge_hundredths_mm").notNull(),
    mainsTensionTenths: integer("mains_tension_tenths").notNull(),
    mainsTensionTenthsKg: integer("mains_tension_tenths_kg")
      .notNull()
      .generatedAlwaysAs(kgTenths("mains_tension_tenths"), { mode: "stored" }),
    crossesStringId: integer("crosses_string_id")
      .notNull()
      .references(() => string.id, { onDelete: "restrict" }),
    crossesGaugeHundredthsMm: integer("crosses_gauge_hundredths_mm").notNull(),
    crossesTensionTenths: integer("crosses_tension_tenths").notNull(),
    crossesTensionTenthsKg: integer("crosses_tension_tenths_kg")
      .notNull()
      .generatedAlwaysAs(kgTenths("crosses_tension_tenths"), { mode: "stored" }),
    createdBy: integer("created_by")
      .notNull()
      .references(() => reviewer.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    check(
      "setup_tension_unit_valid",
      sql`${table.tensionUnit} IN (${sql.raw(TENSION_UNITS.map((unit) => `'${unit}'`).join(", "))})`,
    ),
    // date() normalises: 2024-02-30 comes back as 2024-03-01, garbage as NULL,
    // so only a real YYYY-MM-DD date equals its own date(). IS, not =, because
    // a NULL from = would pass the check.
    check("setup_strung_on_valid", sql`date(${table.strungOn}) IS ${table.strungOn}`),
    check("setup_mains_gauge_valid", gaugeInRange(sql`${table.mainsGaugeHundredthsMm}`)),
    check("setup_crosses_gauge_valid", gaugeInRange(sql`${table.crossesGaugeHundredthsMm}`)),
    check(
      "setup_mains_tension_valid",
      tensionInRange(sql`${table.mainsTensionTenths}`, sql`${table.tensionUnit}`),
    ),
    check(
      "setup_crosses_tension_valid",
      tensionInRange(sql`${table.crossesTensionTenths}`, sql`${table.tensionUnit}`),
    ),
    // Product rule 2: each setup exists once, tensions compared in kg.
    uniqueIndex("setup_stringing_unique").on(
      table.racquetId,
      table.strungOn,
      table.mainsStringId,
      table.mainsGaugeHundredthsMm,
      table.mainsTensionTenthsKg,
      table.crossesStringId,
      table.crossesGaugeHundredthsMm,
      table.crossesTensionTenthsKg,
    ),
    // The foreign-key check when deleting a string, and a string's setups,
    // would otherwise scan the whole table. (A racquet's setups use the
    // unique index above, which starts with racquet_id.)
    index("setup_mains_string_id_idx").on(table.mainsStringId),
    index("setup_crosses_string_id_idx").on(table.crossesStringId),
  ],
);

/**
 * Whole number 1–10 (Product rule 5). typeof rejects a REAL like 5.5 and text
 * like 'seven'; the column's INTEGER affinity has already turned '7' and 7.0
 * into the integer 7 before the check runs, so what's stored is always an
 * integer.
 */
function scoreValid(score: SQL): SQL {
  return sql`typeof(${score}) = 'integer' AND ${score} BETWEEN 1 AND 10`;
}

/**
 * One reviewer's scores for one setup (Product rules 2, 4 and 5). Adding a
 * criterion means a new column and check, and a migration.
 */
export const review = sqliteTable(
  "review",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    setupId: integer("setup_id")
      .notNull()
      .references(() => setup.id, { onDelete: "restrict" }),
    reviewerId: integer("reviewer_id")
      .notNull()
      .references(() => reviewer.id, { onDelete: "restrict" }),
    power: integer("power").notNull(),
    control: integer("control").notNull(),
    comfort: integer("comfort").notNull(),
    spin: integer("spin").notNull(),
    feel: integer("feel").notNull(),
    /** The optional written review. */
    body: text("body"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    // Drizzle sets this on every update it runs; raw SQL updates must set it.
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    unique("review_setup_reviewer_unique").on(table.setupId, table.reviewerId),
    check("review_power_valid", scoreValid(sql`${table.power}`)),
    check("review_control_valid", scoreValid(sql`${table.control}`)),
    check("review_comfort_valid", scoreValid(sql`${table.comfort}`)),
    check("review_spin_valid", scoreValid(sql`${table.spin}`)),
    check("review_feel_valid", scoreValid(sql`${table.feel}`)),
    // Optional, but not an empty box saved as a review.
    check(
      "review_body_not_blank",
      sql`${table.body} IS NULL OR length(${trimWhitespace(sql`${table.body}`)}) > 0`,
    ),
  ],
);
