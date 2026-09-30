// Must be first: it sets up the test database (see the file).
import "@/data/test-database";
import assert from "node:assert/strict";
import { test } from "node:test";
import { asc } from "drizzle-orm";
import {
  convertTension,
  formatGauge,
  formatTension,
  tensionTenthsInKg,
  type TensionUnit,
} from "@/data/units";
import { getDb } from "@/db/client";
import { setup } from "@/db/schema";

const EZONE = 1;
const POLYTOUR_PRO = 1;
const BEN = 1;

test("the kg used to spot duplicates agrees with the database for every accepted tension", async () => {
  // Every tenth from 30.0 to 80.0 lb and from 13.6 to 36.3 kg, one setup
  // each on its own date so the duplicate rule (which compares these kg
  // values) never trips.
  const tensions: { unit: TensionUnit; tenths: number }[] = [
    ...Array.from({ length: 501 }, (_, index) => ({ unit: "lb" as const, tenths: 300 + index })),
    ...Array.from({ length: 228 }, (_, index) => ({ unit: "kg" as const, tenths: 136 + index })),
  ];
  await getDb()
    .insert(setup)
    .values(
      tensions.map(({ unit, tenths }, index) => ({
        racquetId: EZONE,
        strungOn: new Date(Date.UTC(2000, 0, 1 + index)).toISOString().slice(0, 10),
        tensionUnit: unit,
        mainsStringId: POLYTOUR_PRO,
        mainsGaugeHundredthsMm: 125,
        mainsTensionTenths: tenths,
        crossesStringId: POLYTOUR_PRO,
        crossesGaugeHundredthsMm: 125,
        crossesTensionTenths: tenths,
        createdBy: BEN,
      })),
    );
  const rows = await getDb()
    .select({ unit: setup.tensionUnit, typed: setup.mainsTensionTenths, kg: setup.mainsTensionTenthsKg })
    .from(setup)
    .orderBy(asc(setup.id));

  assert.equal(rows.length, tensions.length);
  for (const { unit, typed, kg } of rows) {
    const label = `${typed / 10} ${unit}`;
    assert.equal(tensionTenthsInKg(typed, unit), kg, label);
    if (unit === "lb") assert.equal(convertTension(typed / 10, "lb"), kg / 10, label);
  }
});

test("kg → lb is the reverse conversion, to 1 dp", () => {
  assert.equal(convertTension(24.9, "kg"), 54.9); // 54.895 lb
  assert.equal(convertTension(13.6, "kg"), 30); // 29.983 lb
  assert.equal(convertTension(36.3, "kg"), 80); // 80.027 lb
});

test("a tension shows as typed, then in the other unit to 1 dp", () => {
  assert.deepEqual(formatTension(55, "lb"), { typed: "55 lb", other: "24.9 kg" });
  assert.deepEqual(formatTension(55.5, "lb"), { typed: "55.5 lb", other: "25.2 kg" });
  assert.deepEqual(formatTension(24, "kg"), { typed: "24 kg", other: "52.9 lb" });
  // The other unit keeps its decimal place even when it's zero.
  assert.deepEqual(formatTension(53, "lb"), { typed: "53 lb", other: "24.0 kg" });
  assert.deepEqual(formatTension(13.6, "kg"), { typed: "13.6 kg", other: "30.0 lb" });
});

test("a gauge always shows 2 decimal places in mm", () => {
  assert.equal(formatGauge(1.25), "1.25 mm");
  assert.equal(formatGauge(1.3), "1.30 mm");
});
