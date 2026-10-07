import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, afterEach, beforeEach, test } from "node:test";
import { createClient, type Client, type InArgs } from "@libsql/client";
import { asc, eq } from "drizzle-orm";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "@/db/schema";
import { review, setup, string } from "@/db/schema";

// Every test gets a fresh database file with all of drizzle/ applied, and a
// client made the way src/db/client.ts makes it, so these run against the
// real migrations and the app's foreign-key setting, never local.db.
const dir = mkdtempSync(path.join(tmpdir(), "lx-tennis-schema-"));
let counter = 0;
let client: Client;
let db: LibSQLDatabase<typeof schema>;

beforeEach(async () => {
  client = createClient({ url: `file:${path.join(dir, `test-${++counter}.db`)}` });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
});

afterEach(() => client.close());
after(() => rmSync(dir, { recursive: true, force: true }));

// Seeded ids on a fresh database: racquets 1–4, reviewers 1–3, strings 1–10
// in the seed order.
const EZONE = 1;
const VCORE = 2;
const BEN = 1;
const MICHAL = 2;
const OTAVIO = 3;
const POLYTOUR_PRO = 1;
const POLYTOUR_REV = 4;
const HYPER_G = 6;

let day = 0;
/** A date no earlier call returned, so setups that should both go in don't collide. */
function nextDate(): string {
  return new Date(Date.UTC(2025, 0, 1 + day++)).toISOString().slice(0, 10);
}

type NewSetup = typeof setup.$inferInsert;
type NewReview = typeof review.$inferInsert;

/** Full bed: POLYTOUR PRO 1.25 in an EZONE at 55 lb mains and crosses. */
function fullBed(overrides: Partial<NewSetup> = {}): NewSetup {
  return {
    racquetId: EZONE,
    strungOn: "2026-09-01",
    tensionUnit: "lb",
    mainsStringId: POLYTOUR_PRO,
    mainsGaugeHundredthsMm: 125,
    mainsTensionTenths: 550,
    crossesStringId: POLYTOUR_PRO,
    crossesGaugeHundredthsMm: 125,
    crossesTensionTenths: 550,
    createdBy: BEN,
    ...overrides,
  };
}

/** Hybrid: POLYTOUR PRO 1.25 at 55 lb mains, Hyper-G 1.20 at 53 lb crosses. */
function hybrid(overrides: Partial<NewSetup> = {}): NewSetup {
  return fullBed({
    crossesStringId: HYPER_G,
    crossesGaugeHundredthsMm: 120,
    crossesTensionTenths: 530,
    ...overrides,
  });
}

async function addSetup(values: NewSetup): Promise<typeof setup.$inferSelect> {
  const [row] = await db.insert(setup).values(values).returning();
  return row;
}

function scores(overrides: Partial<NewReview> = {}): NewReview {
  return {
    setupId: 1,
    reviewerId: BEN,
    power: 7,
    control: 8,
    comfort: 6,
    spin: 9,
    feel: 7,
    ...overrides,
  };
}

/** Drizzle wraps the driver's error; the constraint name is in the cause. */
function messages(error: unknown): string {
  const parts: string[] = [];
  for (let current = error; current instanceof Error; current = current.cause) {
    parts.push(current.message);
  }
  return parts.join(" | ");
}

async function assertRefused(action: Promise<unknown>, reason: RegExp): Promise<void> {
  await assert.rejects(action, (error) => {
    assert.match(messages(error), reason);
    return true;
  });
}

/** Raw insert, for values Drizzle's types wouldn't let through. */
function rawInsert(table: string, columns: Record<string, unknown>): Promise<unknown> {
  const names = Object.keys(columns);
  return client.execute({
    sql: `INSERT INTO ${table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`,
    args: Object.values(columns) as InArgs,
  });
}

// SQLite names the index's columns, not the index, when it refuses.
const DUPLICATE_SETUP =
  /UNIQUE constraint failed: setup\.racquet_id, setup\.strung_on, setup\.mains_string_id, setup\.mains_gauge_hundredths_mm, setup\.mains_tension_tenths_kg, setup\.crosses_string_id, setup\.crosses_gauge_hundredths_mm, setup\.crosses_tension_tenths_kg/;

// --- Seeds ---

test("seeds the four line-up racquets with their specs in grams and their photos", async () => {
  const rows = await db
    .select()
    .from(schema.racquet)
    .orderBy(asc(schema.racquet.id));
  assert.deepEqual(
    rows.map(({ id, slug, brand, name, year, generation, imageSrc, headSizeSqIn, weightGrams, balanceMm, lengthIn, stringMains, stringCrosses, createdBy }) => ({
      id, slug, brand, name, year, generation, imageSrc, headSizeSqIn, weightGrams, balanceMm, lengthIn, stringMains, stringCrosses, createdBy,
    })),
    [
      { id: 1, slug: "yonex-ezone-98-2022", brand: "Yonex", name: "Yonex EZONE 98", year: 2022, generation: "7th gen", imageSrc: "/images/racquets/yonex-ezone-98-2022.webp", headSizeSqIn: 98, weightGrams: 305, balanceMm: 315, lengthIn: 27, stringMains: 16, stringCrosses: 19, createdBy: null },
      { id: 2, slug: "yonex-vcore-98-2023", brand: "Yonex", name: "Yonex VCORE 98", year: 2023, generation: "7th gen", imageSrc: "/images/racquets/yonex-vcore-98-2023.webp", headSizeSqIn: 98, weightGrams: 305, balanceMm: 315, lengthIn: 27, stringMains: 16, stringCrosses: 19, createdBy: null },
      { id: 3, slug: "yonex-percept-97-2023", brand: "Yonex", name: "Yonex PERCEPT 97", year: 2023, generation: null, imageSrc: "/images/racquets/yonex-percept-97-2023.webp", headSizeSqIn: 97, weightGrams: 310, balanceMm: 310, lengthIn: 27, stringMains: 16, stringCrosses: 19, createdBy: null },
      { id: 4, slug: "babolat-pure-aero-98-2023", brand: "Babolat", name: "Babolat Pure Aero 98", year: 2023, generation: "8th gen", imageSrc: "/images/racquets/babolat-pure-aero-98-2023.webp", headSizeSqIn: 98, weightGrams: 305, balanceMm: 315, lengthIn: 27, stringMains: 16, stringCrosses: 20, createdBy: null },
    ],
  );
  // Every built-in racquet has an alt text that starts with its name.
  for (const row of rows) assert.ok(row.imageAlt.startsWith(row.name));
});

// --- Racquets ---

/** A valid added racquet with no specs; override what a test is about. */
function racquetRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "head-speed-mp-2024",
    brand: "Head",
    name: "Head Speed MP",
    year: 2024,
    image_src: "https://example.public.blob.vercel-storage.com/racquets/head.webp",
    image_alt: "Head Speed MP (2024) racquet",
    ...overrides,
  };
}

test("a racquet can be added with no specs, and the specs it lacks stay null", async () => {
  await rawInsert("racquet", racquetRow());
  const [row] = await db.select().from(schema.racquet).where(eq(schema.racquet.slug, "head-speed-mp-2024"));
  assert.equal(row.id, 5);
  assert.equal(row.headSizeSqIn, null);
  assert.equal(row.stringMains, null);
  assert.equal(row.createdBy, null);
});

test("a racquet's slug is unique and a URL segment", async () => {
  await rawInsert("racquet", racquetRow());
  await assertRefused(rawInsert("racquet", racquetRow()), /UNIQUE constraint failed: racquet\.slug/);
  await assertRefused(rawInsert("racquet", racquetRow({ slug: "Head Speed" })), /racquet_slug_format/);
});

test("a racquet's brand is one of the line-up's brands, and its name starts with it", async () => {
  await assertRefused(rawInsert("racquet", racquetRow({ brand: "Prince", name: "Prince Phantom" })), /racquet_brand_valid/);
  await assertRefused(rawInsert("racquet", racquetRow({ name: "Babolat Speed MP" })), /racquet_name_valid/);
  await assertRefused(rawInsert("racquet", racquetRow({ name: "Head " })), /racquet_name_valid/);
  await assertRefused(rawInsert("racquet", racquetRow({ name: "Head" })), /racquet_name_valid/);
  await assertRefused(rawInsert("racquet", racquetRow({ image_src: " " })), /racquet_image_valid/);
  await assertRefused(rawInsert("racquet", racquetRow({ year: 1900 })), /racquet_year_valid/);
  await assertRefused(rawInsert("racquet", racquetRow({ year: 2024.5 })), /racquet_year_valid/);
});

test("a racquet's specs are range-checked, grams only, and need no source (Product rules 10 and 11)", async () => {
  await assertRefused(rawInsert("racquet", racquetRow({ head_size_sq_in: 20 })), /racquet_head_size_valid/);
  await assertRefused(rawInsert("racquet", racquetRow({ weight_grams: 5000 })), /racquet_weight_grams_valid/);
  await assertRefused(rawInsert("racquet", racquetRow({ weight_grams: 305.5 })), /racquet_weight_grams_valid/);
  await assertRefused(rawInsert("racquet", racquetRow({ balance_mm: 10 })), /racquet_balance_valid/);
  await assertRefused(rawInsert("racquet", racquetRow({ length_in: 40 })), /racquet_length_valid/);
  await assertRefused(rawInsert("racquet", racquetRow({ head_size_sq_in: 98.5 })), /racquet_head_size_valid/);
  await assertRefused(rawInsert("racquet", racquetRow({ string_mains: 16 })), /racquet_string_pattern_pair/);
  await assertRefused(rawInsert("racquet", racquetRow({ string_mains: 3, string_crosses: 19 })), /racquet_string_mains_valid/);
  // Ounces and a source link are not columns any more.
  await assertRefused(rawInsert("racquet", racquetRow({ weight_ounces: 10.5 })), /no column named weight_ounces/);
  await assertRefused(rawInsert("racquet", racquetRow({ source_url: "https://www.head.com/en/speed-mp" })), /no column named source_url/);
  const columns = (await client.execute("SELECT name FROM pragma_table_info('racquet')")).rows.map((row) => row.name);
  assert.ok(!columns.includes("weight_ounces") && !columns.includes("source_url"));
  // Specs with no source at all are fine.
  await rawInsert(
    "racquet",
    racquetRow({
      head_size_sq_in: 100,
      weight_grams: 300,
      balance_mm: 320,
      length_in: 27.25,
      string_mains: 16,
      string_crosses: 19,
    }),
  );
});

test("a racquet in use by a setup can't be deleted, and the reviewer who added one can't be deleted", async () => {
  await addSetup(fullBed());
  await assertRefused(client.execute("DELETE FROM racquet WHERE id = 1"), /FOREIGN KEY constraint failed/);
  await db.insert(schema.racquet).values({
    slug: "head-speed-mp-2024",
    brand: "Head",
    name: "Head Speed MP",
    year: 2024,
    imageSrc: "/x.webp",
    imageAlt: "x",
    createdBy: MICHAL,
  });
  await assertRefused(client.execute(`DELETE FROM reviewer WHERE id = ${MICHAL}`), /FOREIGN KEY constraint failed/);
});

/**
 * Runs `body` on a database migrated only up to just before the newest
 * migrations, `dropped` being their tags (newest first), to test an upgrade
 * the way Turso gets it. `migrateRest` then applies those migrations from the
 * real drizzle/ folder on the same file, as `npm run db:migrate` does.
 */
async function upgradingFrom(
  dropped: string[],
  body: (oldClient: Client, migrateRest: () => Promise<void>) => Promise<void>,
): Promise<void> {
  const upgradeDir = mkdtempSync(path.join(dir, "upgrade-"));
  const folder = path.join(upgradeDir, "drizzle");
  cpSync(path.join(process.cwd(), "drizzle"), folder, { recursive: true });
  const journalPath = path.join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  const taken = dropped.map(() => journal.entries.pop());
  assert.deepEqual(taken.map((entry) => entry.tag), dropped);
  writeFileSync(journalPath, JSON.stringify(journal));

  const oldClient = createClient({ url: `file:${path.join(upgradeDir, "old.db")}` });
  try {
    const oldDb = drizzle(oldClient, { schema });
    await migrate(oldDb, { migrationsFolder: folder });
    await body(oldClient, () => migrate(oldDb, { migrationsFolder: path.join(process.cwd(), "drizzle") }));
  } finally {
    oldClient.close();
  }
}

test("migrations 0006 and 0007 keep the racquets' ids and the setups and reviews that point at them", async () => {
  // The deployed database already has setups and reviews on racquets when
  // 0006 runs, and its table rebuild (and 0007's after it, applied in the same
  // run as Turso will get them) must not lose, renumber or orphan them.
  await upgradingFrom(["0007_racquet_grams_only_no_source", "0006_racquets_in_database"], async (oldClient, migrateRest) => {
    await oldClient.execute(
      `INSERT INTO setup (racquet_id, strung_on, tension_unit, mains_string_id, mains_gauge_hundredths_mm, mains_tension_tenths,
         crosses_string_id, crosses_gauge_hundredths_mm, crosses_tension_tenths, created_by)
       VALUES (4, '2026-09-01', 'lb', 1, 125, 550, 1, 125, 550, 1)`,
    );
    await oldClient.execute(
      `INSERT INTO review (setup_id, reviewer_id, power, control, comfort, spin, feel) VALUES (1, 1, 7, 8, 6, 9, 7)`,
    );
    const sequenceBefore = await oldClient.execute("SELECT seq FROM sqlite_sequence WHERE name = 'racquet'");

    // 0006 and 0007 together, on the same file.
    await migrateRest();

    const racquets = await oldClient.execute("SELECT id, slug FROM racquet ORDER BY id");
    assert.deepEqual(
      racquets.rows.map((row) => [row.id, row.slug]),
      [[1, "yonex-ezone-98-2022"], [2, "yonex-vcore-98-2023"], [3, "yonex-percept-97-2023"], [4, "babolat-pure-aero-98-2023"]],
    );
    const joined = await oldClient.execute(
      "SELECT racquet.name, review.power FROM setup JOIN racquet ON racquet.id = setup.racquet_id JOIN review ON review.setup_id = setup.id",
    );
    assert.deepEqual(joined.rows.map((row) => [row.name, row.power]), [["Babolat Pure Aero 98", 7]]);
    assert.equal((await oldClient.execute("PRAGMA foreign_key_check")).rows.length, 0);
    // AUTOINCREMENT carries on past the old rows: a new racquet is never given an id a deleted one had.
    assert.equal(sequenceBefore.rows[0].seq, 4);
    await oldClient.execute(
      `INSERT INTO racquet (slug, brand, name, year, image_src, image_alt) VALUES ('head-a-2024', 'Head', 'Head A', 2024, '/a.webp', 'a')`,
    );
    assert.equal((await oldClient.execute("SELECT max(id) AS id FROM racquet")).rows[0].id, 5);
    // The rebuilt table keeps its foreign keys on: the racquet is still in use.
    await assertRefused(oldClient.execute("DELETE FROM racquet WHERE id = 4"), /FOREIGN KEY constraint failed/);
  });
});

test("migration 0007 drops ounces and the source link, keeping every racquet row and the setups and reviews on them", async () => {
  // The state a database is in after 0006: racquets with ounces and a source
  // link, a reviewer-added one among them, and setups and reviews on both.
  await upgradingFrom(["0007_racquet_grams_only_no_source"], async (oldClient, migrateRest) => {
    const before = await oldClient.execute("SELECT name FROM pragma_table_info('racquet')");
    const beforeColumns = before.rows.map((row) => row.name);
    assert.ok(beforeColumns.includes("weight_ounces") && beforeColumns.includes("source_url"), "0006 still has both");

    await oldClient.execute(
      `INSERT INTO racquet (slug, brand, name, year, generation, image_src, image_alt, head_size_sq_in, weight_grams, weight_ounces,
         balance_mm, length_in, string_mains, string_crosses, source_url, created_by, created_at)
       VALUES ('head-speed-mp-2024', 'Head', 'Head Speed MP', 2024, '2nd gen', 'https://x.public.blob.vercel-storage.com/a.webp', 'Head Speed MP (2024) racquet',
         100, 300, 10.5821, 320, 27.25, 16, 19, 'https://www.head.com/en/speed-mp', 2, 1700000000)`,
    );
    await oldClient.execute(
      `INSERT INTO racquet (slug, brand, name, year, image_src, image_alt) VALUES ('head-bare-2024', 'Head', 'Head Bare', 2024, '/b.webp', 'b')`,
    );
    const insertSetup = (racquetId: number, date: string) =>
      oldClient.execute({
        sql: `INSERT INTO setup (racquet_id, strung_on, tension_unit, mains_string_id, mains_gauge_hundredths_mm, mains_tension_tenths,
           crosses_string_id, crosses_gauge_hundredths_mm, crosses_tension_tenths, created_by)
           VALUES (?, ?, 'lb', 1, 125, 550, 1, 125, 550, 1)`,
        args: [racquetId, date],
      });
    await insertSetup(4, "2026-09-01"); // a built-in racquet
    await insertSetup(5, "2026-09-02"); // the reviewer-added one
    await oldClient.execute(`INSERT INTO review (setup_id, reviewer_id, power, control, comfort, spin, feel) VALUES (1, 1, 7, 8, 6, 9, 7)`);
    await oldClient.execute(`INSERT INTO review (setup_id, reviewer_id, power, control, comfort, spin, feel) VALUES (2, 2, 5, 5, 5, 5, 5)`);
    const rowsBefore = (await oldClient.execute(
      "SELECT id, slug, brand, name, year, generation, image_src, image_alt, head_size_sq_in, weight_grams, balance_mm, length_in, string_mains, string_crosses, created_by, created_at FROM racquet ORDER BY id",
    )).rows.map((row) => ({ ...row }));
    const sequenceBefore = await oldClient.execute("SELECT seq FROM sqlite_sequence WHERE name = 'racquet'");
    assert.equal(sequenceBefore.rows[0].seq, 6);

    await migrateRest();

    const columns = (await oldClient.execute("SELECT name FROM pragma_table_info('racquet')")).rows.map((row) => row.name);
    assert.ok(!columns.includes("weight_ounces") && !columns.includes("source_url"), columns.join(", "));
    assert.ok(columns.includes("weight_grams"));
    const rowsAfter = (await oldClient.execute(
      "SELECT id, slug, brand, name, year, generation, image_src, image_alt, head_size_sq_in, weight_grams, balance_mm, length_in, string_mains, string_crosses, created_by, created_at FROM racquet ORDER BY id",
    )).rows.map((row) => ({ ...row }));
    assert.deepEqual(rowsAfter, rowsBefore, "same ids, same values, grams kept");
    assert.equal(rowsAfter.length, 6);

    const joined = await oldClient.execute(
      "SELECT racquet.slug, review.power FROM setup JOIN racquet ON racquet.id = setup.racquet_id JOIN review ON review.setup_id = setup.id ORDER BY setup.id",
    );
    assert.deepEqual(joined.rows.map((row) => [row.slug, row.power]), [["babolat-pure-aero-98-2023", 7], ["head-speed-mp-2024", 5]]);
    assert.equal((await oldClient.execute("PRAGMA foreign_key_check")).rows.length, 0);
    // The rebuilt table keeps foreign keys: a racquet with setups can't be deleted, nor a reviewer who added one.
    await assertRefused(oldClient.execute("DELETE FROM racquet WHERE id = 4"), /FOREIGN KEY constraint failed/);
    await assertRefused(oldClient.execute("DELETE FROM racquet WHERE id = 5"), /FOREIGN KEY constraint failed/);
    await assertRefused(oldClient.execute("DELETE FROM reviewer WHERE id = 2"), /FOREIGN KEY constraint failed/);
    // AUTOINCREMENT carries on past the old rows.
    await oldClient.execute(
      `INSERT INTO racquet (slug, brand, name, year, image_src, image_alt) VALUES ('head-next-2024', 'Head', 'Head Next', 2024, '/n.webp', 'n')`,
    );
    assert.equal((await oldClient.execute("SELECT max(id) AS id FROM racquet")).rows[0].id, 7);
    // The slug stays unique, and specs no longer need a source.
    await assertRefused(
      oldClient.execute(`INSERT INTO racquet (slug, brand, name, year, image_src, image_alt) VALUES ('head-next-2024', 'Head', 'Head Next', 2024, '/n.webp', 'n')`),
      /UNIQUE constraint failed: racquet\.slug/,
    );
    await oldClient.execute(
      `INSERT INTO racquet (slug, brand, name, year, image_src, image_alt, head_size_sq_in, weight_grams) VALUES ('head-spec-2024', 'Head', 'Head Spec', 2024, '/s.webp', 's', 98, 300)`,
    );
  });
});

test("seeds Ben's ten strings as the manufacturer writes them, with their types", async () => {
  const rows = await db
    .select({ brand: string.brand, name: string.name, type: string.type })
    .from(string)
    .orderBy(asc(string.id));
  const yonex = ["POLYTOUR PRO", "POLYTOUR FIRE", "POLYTOUR DRIVE", "POLYTOUR REV", "POLYTOUR SPIN"];
  const solinco = ["Hyper-G", "Hyper-G Soft", "Confidential", "Confidential Soft", "Mach-10"];
  assert.deepEqual(rows, [
    ...yonex.map((name) => ({ brand: "Yonex", name, type: "polyester" })),
    ...solinco.map((name) => ({ brand: "Solinco", name, type: "co-polyester" })),
  ]);
});

// --- Reviewer emails ---

test("the seeded reviewers have no email until one is set", async () => {
  const rows = await db
    .select({ email: schema.reviewer.email })
    .from(schema.reviewer)
    .orderBy(asc(schema.reviewer.id));
  assert.deepEqual(rows, [{ email: null }, { email: null }, { email: null }]);
});

test("an email is unique ignoring case, even from a raw insert that skips the app's checks", async () => {
  // Set one for Ben the way the app does: trimmed and lowercased.
  await db.update(schema.reviewer).set({ email: "ben@example.com" }).where(eq(schema.reviewer.id, BEN));
  // A raw insert of the same address, or any casing of it, can't take it:
  // the unique index folds case itself, so the app's lowercasing isn't the
  // only thing standing between Ben and a duplicate.
  for (const [i, email] of ["ben@example.com", "BEN@example.com", "Ben@Example.com"].entries()) {
    await assertRefused(
      rawInsert("reviewer", { username: `raw${i}`, display_name: "Raw", password_hash: null, email }),
      /UNIQUE constraint failed: index 'reviewer_email_unique'/,
    );
  }
  // NULLs don't collide: Michal can still set his own address.
  await db.update(schema.reviewer).set({ email: "michal@example.com" }).where(eq(schema.reviewer.id, MICHAL));
});

test("a reviewer email can't be blank or over the length cap, and NULL needs no value", async () => {
  for (const [i, email] of [" ", " ben@example.com", "ben@example.com "].entries()) {
    await assertRefused(
      rawInsert("reviewer", { username: `blank${i}`, display_name: "Raw", password_hash: null, email }),
      /reviewer_email_trimmed/,
    );
  }
  await assertRefused(
    rawInsert("reviewer", {
      username: "long",
      display_name: "Raw",
      password_hash: null,
      email: `${"a".repeat(243)}@example.com`, // 255 characters
    }),
    /reviewer_email_length/,
  );
  // 254 characters is the cap, as in src/data/limits.ts.
  await rawInsert("reviewer", {
    username: "at460",
    display_name: "Raw",
    password_hash: null,
    email: `${"a".repeat(242)}@example.com`, // 254 characters
  });
});

// --- Strings ---

test("a string's brand and name are unique regardless of case", async () => {
  await assertRefused(
    db.insert(string).values({ brand: "solinco", name: "HYPER-G", type: "co-polyester" }),
    /UNIQUE constraint failed: index 'string_brand_name_unique'/,
  );
  // Same name under another brand is a different string.
  await db.insert(string).values({ brand: "Yonex", name: "Hyper-G", type: "polyester" });
});

test("a string needs a non-blank, trimmed brand and name and a listed type", async () => {
  const good = { brand: "Babolat", name: "RPM Blast", type: "polyester" } as const;
  await assertRefused(db.insert(string).values({ ...good, brand: " " }), /string_brand_trimmed/);
  await assertRefused(db.insert(string).values({ ...good, brand: "Babolat " }), /string_brand_trimmed/);
  await assertRefused(db.insert(string).values({ ...good, name: "RPM Blast\n" }), /string_name_trimmed/);
  await assertRefused(db.insert(string).values({ ...good, name: "" }), /string_name_trimmed/);
  await assertRefused(
    rawInsert("string", { brand: "Babolat", name: "VS Touch", type: "Natural gut" }),
    /string_type_valid/,
  );
  for (const type of schema.STRING_TYPES) {
    await db.insert(string).values({ ...good, name: `RPM ${type}`, type });
  }
});

// --- Setups: kg and duplicates ---

test("the database calculates each tension in kg to 1 dp from the typed number and unit", async () => {
  const lb = await addSetup(hybrid({ mainsTensionTenths: 550, crossesTensionTenths: 555 }));
  assert.equal(lb.mainsTensionTenthsKg, 249); // 55 lb = 24.9476 kg
  assert.equal(lb.crossesTensionTenthsKg, 252); // 55.5 lb = 25.1744 kg
  const kg = await addSetup(
    fullBed({ tensionUnit: "kg", mainsTensionTenths: 249, crossesTensionTenths: 240, strungOn: nextDate() }),
  );
  assert.equal(kg.mainsTensionTenthsKg, 249);
  assert.equal(kg.crossesTensionTenthsKg, 240);
  // It follows the typed value; nobody can write a kg that disagrees.
  const [edited] = await db
    .update(setup)
    .set({ mainsTensionTenths: 600 })
    .where(eq(setup.id, lb.id))
    .returning();
  assert.equal(edited.mainsTensionTenthsKg, 272); // 60 lb = 27.2155 kg
  await assertRefused(
    client.execute(`UPDATE setup SET mains_tension_tenths_kg = 1 WHERE id = ${lb.id}`),
    /generated column/,
  );
});

test("the same setup can't be entered twice", async () => {
  await addSetup(fullBed());
  await assertRefused(addSetup(fullBed({ createdBy: MICHAL })), DUPLICATE_SETUP);
  await addSetup(hybrid());
  await assertRefused(addSetup(hybrid({ createdBy: MICHAL })), DUPLICATE_SETUP);
});

test("a duplicate is caught across units on both sides: 55/53 lb is 24.9/24.0 kg", async () => {
  await addSetup(fullBed({ mainsTensionTenths: 550, crossesTensionTenths: 530 }));
  await assertRefused(
    addSetup(fullBed({ tensionUnit: "kg", mainsTensionTenths: 249, crossesTensionTenths: 240 })),
    DUPLICATE_SETUP,
  );
  await addSetup(hybrid({ mainsTensionTenths: 550, crossesTensionTenths: 530 }));
  await assertRefused(
    addSetup(hybrid({ tensionUnit: "kg", mainsTensionTenths: 249, crossesTensionTenths: 240 })),
    DUPLICATE_SETUP,
  );
  // Ben's call: compared in kg to 1 dp, 54.9 lb is 55 lb (both 24.9 kg).
  await assertRefused(
    addSetup(fullBed({ mainsTensionTenths: 549, crossesTensionTenths: 530 })),
    DUPLICATE_SETUP,
  );
});

test("a hybrid with the same string and gauge on both sides is that full bed, so it collides", async () => {
  await addSetup(fullBed({ mainsTensionTenths: 550, crossesTensionTenths: 530 }));
  // Entered from the hybrid side of the form, in kg: still the same stringing.
  await assertRefused(
    addSetup(
      hybrid({
        tensionUnit: "kg",
        crossesStringId: POLYTOUR_PRO,
        crossesGaugeHundredthsMm: 125,
        mainsTensionTenths: 249,
        crossesTensionTenths: 240,
      }),
    ),
    DUPLICATE_SETUP,
  );
});

test("a full bed can have different mains and crosses tensions, and a hybrid the same string", async () => {
  await addSetup(fullBed({ mainsTensionTenths: 550, crossesTensionTenths: 550 }));
  await addSetup(fullBed({ mainsTensionTenths: 550, crossesTensionTenths: 530 }));
  // Same string, different gauges: a hybrid.
  await addSetup(fullBed({ mainsGaugeHundredthsMm: 125, crossesGaugeHundredthsMm: 130 }));
});

test("setups differing in any part are different setups", async () => {
  await addSetup(hybrid());
  await addSetup(hybrid({ mainsTensionTenths: 555 })); // 55.5 lb (25.2 kg) ≠ 55 lb (24.9 kg)
  await addSetup(hybrid({ crossesTensionTenths: 535 }));
  await addSetup(hybrid({ strungOn: "2026-09-08" })); // restrung on a new date
  await addSetup(hybrid({ racquetId: VCORE }));
  await addSetup(hybrid({ mainsStringId: POLYTOUR_REV }));
  await addSetup(hybrid({ mainsGaugeHundredthsMm: 130 }));
  await addSetup(hybrid({ crossesStringId: POLYTOUR_REV }));
  await addSetup(hybrid({ crossesGaugeHundredthsMm: 125 }));
  // Mains and crosses swapped is a different stringing too.
  await addSetup(
    hybrid({
      mainsStringId: HYPER_G,
      mainsGaugeHundredthsMm: 120,
      mainsTensionTenths: 530,
      crossesStringId: POLYTOUR_PRO,
      crossesGaugeHundredthsMm: 125,
      crossesTensionTenths: 550,
    }),
  );
});

// --- Setups: shape and ranges ---

test("every setup has a string, gauge and tension for the crosses as well as the mains", async () => {
  for (const column of ["crossesStringId", "crossesGaugeHundredthsMm", "crossesTensionTenths"] as const) {
    await assertRefused(addSetup(fullBed({ [column]: null })), /NOT NULL constraint failed: setup\.crosses_/);
  }
});

test("the tension unit is lb or kg", async () => {
  await assertRefused(
    rawInsert("setup", {
      racquet_id: EZONE,
      strung_on: "2026-09-01",
      tension_unit: "lbs",
      mains_string_id: POLYTOUR_PRO,
      mains_gauge_hundredths_mm: 125,
      mains_tension_tenths: 550,
      crosses_string_id: POLYTOUR_PRO,
      crosses_gauge_hundredths_mm: 125,
      crosses_tension_tenths: 550,
      created_by: BEN,
    }),
    // An unknown unit has no kg value, so the generated column's NOT NULL
    // may fire before the check does; either way it's refused.
    /setup_tension_unit_valid|NOT NULL constraint failed: setup\.mains_tension_tenths_kg/,
  );
});

test("tension is 30–80 lb or 13.6–36.3 kg with at most 1 decimal place", async () => {
  for (const [unit, low, high] of [["lb", 300, 800], ["kg", 136, 363]] as const) {
    for (const ok of [low, high]) {
      await addSetup(
        fullBed({ tensionUnit: unit, mainsTensionTenths: ok, crossesTensionTenths: ok, strungOn: nextDate() }),
      );
    }
    for (const bad of [low - 1, high + 1, low + 0.5]) {
      await assertRefused(
        addSetup(fullBed({ tensionUnit: unit, mainsTensionTenths: bad, crossesTensionTenths: low })),
        /setup_mains_tension_valid/,
      );
      await assertRefused(
        addSetup(fullBed({ tensionUnit: unit, mainsTensionTenths: low, crossesTensionTenths: bad })),
        /setup_crosses_tension_valid/,
      );
    }
  }
  // 55.0 is a fine lb tension but out of range in kg: the unit decides.
  await assertRefused(
    addSetup(fullBed({ tensionUnit: "kg", mainsTensionTenths: 550, crossesTensionTenths: 250 })),
    /setup_mains_tension_valid/,
  );
});

test("gauge is 1.00–1.50 mm with at most 2 decimal places", async () => {
  for (const ok of [100, 150]) {
    await addSetup(fullBed({ mainsGaugeHundredthsMm: ok, crossesGaugeHundredthsMm: ok, strungOn: nextDate() }));
  }
  for (const bad of [99, 151, 125.5]) {
    await assertRefused(addSetup(fullBed({ mainsGaugeHundredthsMm: bad })), /setup_mains_gauge_valid/);
    await assertRefused(addSetup(fullBed({ crossesGaugeHundredthsMm: bad })), /setup_crosses_gauge_valid/);
  }
});

test("date strung is a real YYYY-MM-DD date", async () => {
  await addSetup(fullBed({ strungOn: "2024-02-29" }));
  for (const bad of ["2026-02-29", "2026-02-30", "2026-9-1", "2026-09-01T10:00", "01/09/2026", "yesterday", ""]) {
    await assertRefused(addSetup(fullBed({ strungOn: bad })), /setup_strung_on_valid/);
  }
});

// --- Foreign keys ---

test("a string used by a setup can't be deleted; an unused one can", async () => {
  await addSetup(hybrid({ mainsStringId: POLYTOUR_PRO, crossesStringId: HYPER_G }));
  for (const used of [POLYTOUR_PRO, HYPER_G]) {
    await assertRefused(db.delete(string).where(eq(string.id, used)), /FOREIGN KEY constraint failed/);
  }
  await db.delete(string).where(eq(string.id, POLYTOUR_REV));
  assert.equal((await db.select().from(string).where(eq(string.id, POLYTOUR_REV))).length, 0);
});

test("setups and reviews must point at rows that exist, and a reviewed setup can't be deleted", async () => {
  await assertRefused(addSetup(fullBed({ mainsStringId: 999 })), /FOREIGN KEY constraint failed/);
  await assertRefused(addSetup(hybrid({ crossesStringId: 999 })), /FOREIGN KEY constraint failed/);
  await assertRefused(addSetup(fullBed({ racquetId: 999 })), /FOREIGN KEY constraint failed/);
  const row = await addSetup(fullBed());
  await assertRefused(db.insert(review).values(scores({ setupId: 999 })), /FOREIGN KEY constraint failed/);
  await db.insert(review).values(scores({ setupId: row.id }));
  await assertRefused(db.delete(setup).where(eq(setup.id, row.id)), /FOREIGN KEY constraint failed/);
});

// --- Reviews ---

test("one review per person per setup", async () => {
  const row = await addSetup(fullBed());
  await db.insert(review).values(scores({ setupId: row.id, reviewerId: BEN }));
  await db.insert(review).values(scores({ setupId: row.id, reviewerId: MICHAL }));
  await assertRefused(
    db.insert(review).values(scores({ setupId: row.id, reviewerId: BEN, power: 3 })),
    /UNIQUE constraint failed: review\.setup_id, review\.reviewer_id/,
  );
});

test("every score is required and a whole number 1–10", async () => {
  const row = await addSetup(fullBed());
  const base = { setup_id: row.id, reviewer_id: BEN, power: 7, control: 7, comfort: 7, spin: 7, feel: 7 };
  for (const criterion of ["power", "control", "comfort", "spin", "feel"]) {
    for (const bad of [0, 11, -1, 5.5, "5.5", "seven", "7a"]) {
      await assertRefused(rawInsert("review", { ...base, [criterion]: bad }), new RegExp(`review_${criterion}_valid`));
    }
    const withoutIt = Object.fromEntries(Object.entries(base).filter(([name]) => name !== criterion));
    await assertRefused(rawInsert("review", withoutIt), new RegExp(`NOT NULL constraint failed: review\\.${criterion}`));
  }
  await rawInsert("review", { ...base, power: 1, feel: 10 });
});

test("a score typed as the text '7' is stored as the integer 7", async () => {
  // INTEGER affinity converts it before the check runs, so a stored score is
  // always an integer, never text that would sort and average wrongly.
  const row = await addSetup(fullBed());
  await rawInsert("review", { setup_id: row.id, reviewer_id: BEN, power: "7", control: 7, comfort: 7, spin: 7, feel: 7 });
  const result = await client.execute("SELECT power, typeof(power) AS type FROM review");
  assert.deepEqual({ ...result.rows[0] }, { power: 7, type: "integer" });
});

test("the written review is optional but can't be blank", async () => {
  const row = await addSetup(fullBed());
  await db.insert(review).values(scores({ setupId: row.id, reviewerId: BEN, body: null }));
  await db.insert(review).values(scores({ setupId: row.id, reviewerId: MICHAL, body: "Crisp." }));
  await assertRefused(
    db.insert(review).values(scores({ setupId: row.id, reviewerId: OTAVIO, body: " \n " })),
    /review_body_not_blank/,
  );
});
