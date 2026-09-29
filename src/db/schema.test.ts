import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, afterEach, beforeEach, test } from "node:test";
import { createClient, type Client, type InArgs } from "@libsql/client";
import { asc, eq } from "drizzle-orm";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { getRacquetSlugs } from "@/data/racquets";
import * as schema from "@/db/schema";
import { review, setup, string } from "@/db/schema";

// Every test gets a fresh database file with all of drizzle/ applied, and a
// client made the way src/db/client.ts makes it, so these run against the
// real migrations and the app's foreign-key setting, never local.db.
const dir = mkdtempSync(path.join(tmpdir(), "tennis-setups-schema-"));
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

test("every racquet in src/data/racquets.ts has a row", async () => {
  const rows = await db.select({ slug: schema.racquet.slug }).from(schema.racquet);
  assert.deepEqual(rows.map((row) => row.slug).sort(), (await getRacquetSlugs()).sort());
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
