import assert from "node:assert/strict";
import { test } from "node:test";
import { REVIEW_BODY_MAX_LENGTH } from "@/data/limits";
import { parseRacquetSlug, parseReviewFields, parseSetupForm, parseStrungOn } from "@/reviews/setup-form";

const SLUG = "yonex-ezone-98-2022";
// 10:00 UTC on 29 September 2026.
const NOW = new Date("2026-09-29T10:00:00Z");

/** A valid full bed: POLYTOUR PRO (id 1) 1.25 mm at 55/53 lb. */
function fullBedForm(overrides: Record<string, string | null> = {}): FormData {
  const fields: Record<string, string | null> = {
    racquet: SLUG,
    strungOn: "2026-09-01",
    kind: "full-bed",
    tensionUnit: "lb",
    mainsString: "1",
    mainsGauge: "1.25",
    mainsTension: "55",
    crossesTension: "53",
    power: "7",
    control: "8",
    comfort: "6",
    spin: "9",
    feel: "7",
    body: "",
    ...overrides,
  };
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (value !== null) formData.set(name, value);
  }
  return formData;
}

function hybridForm(overrides: Record<string, string | null> = {}): FormData {
  return fullBedForm({ kind: "hybrid", crossesString: "6", crossesGauge: "1.20", ...overrides });
}

function errorOf(formData: FormData): string | undefined {
  const result = parseSetupForm(formData, SLUG, NOW);
  return result.ok ? undefined : result.error;
}

test("a full bed takes the mains' string and gauge for the crosses, whatever else the form sends", () => {
  const result = parseSetupForm(
    fullBedForm({ crossesString: "6", crossesGauge: "9.99" }),
    SLUG,
    NOW,
  );
  assert.ok(result.ok);
  assert.deepEqual(result.value.mains, { string: { id: 1 }, gaugeHundredthsMm: 125, tensionTenths: 550 });
  assert.deepEqual(result.value.crosses, { string: { id: 1 }, gaugeHundredthsMm: 125, tensionTenths: 530 });
});

test("a hybrid keeps each side's own string, gauge and tension", () => {
  const result = parseSetupForm(hybridForm({ mainsTension: "55.5" }), SLUG, NOW);
  assert.ok(result.ok);
  assert.deepEqual(result.value.mains, { string: { id: 1 }, gaugeHundredthsMm: 125, tensionTenths: 555 });
  assert.deepEqual(result.value.crosses, { string: { id: 6 }, gaugeHundredthsMm: 120, tensionTenths: 530 });
});

test("a hybrid's crosses string and gauge are required", () => {
  assert.equal(errorOf(hybridForm({ crossesString: null })), "invalid");
  assert.equal(errorOf(hybridForm({ crossesGauge: null })), "invalid");
  assert.equal(errorOf(hybridForm({ crossesGauge: "1.6" })), "gauge");
});

test("a new string is trimmed, and needs a brand, a name and a listed type", () => {
  const result = parseSetupForm(
    fullBedForm({
      mainsString: "new",
      mainsNewBrand: "  Babolat ",
      mainsNewName: "RPM Blast\n",
      mainsNewType: "polyester",
    }),
    SLUG,
    NOW,
  );
  assert.ok(result.ok);
  assert.deepEqual(result.value.mains.string, {
    new: { brand: "Babolat", name: "RPM Blast", type: "polyester" },
  });

  const newString = { mainsString: "new", mainsNewBrand: "Babolat", mainsNewName: "RPM Blast", mainsNewType: "polyester" };
  assert.equal(errorOf(fullBedForm({ ...newString, mainsNewBrand: "   " })), "invalid");
  assert.equal(errorOf(fullBedForm({ ...newString, mainsNewName: null })), "invalid");
  assert.equal(errorOf(fullBedForm({ ...newString, mainsNewType: "Natural gut" })), "invalid");
  assert.equal(errorOf(fullBedForm({ ...newString, mainsNewName: "x".repeat(101) })), "invalid");
  assert.equal(errorOf(fullBedForm({ mainsString: "abc" })), "invalid");
  assert.equal(errorOf(fullBedForm({ mainsString: "0" })), "invalid");
});

test("an lb/kg choice is required: nothing is pre-selected", () => {
  assert.equal(errorOf(fullBedForm({ tensionUnit: null })), "unit");
  assert.equal(errorOf(fullBedForm({ tensionUnit: "N" })), "unit");
});

test("tensions are 30–80 lb or 13.6–36.3 kg with at most 1 decimal place", () => {
  for (const tension of ["30", "80", "55.5", "55.50", " 55 "]) {
    assert.equal(errorOf(fullBedForm({ mainsTension: tension })), undefined, tension);
  }
  for (const tension of ["29.9", "80.1", "55.25", "", "abc", "-55", "5e1", "55,5"]) {
    assert.equal(errorOf(fullBedForm({ mainsTension: tension })), "tension", tension);
  }
  // The range follows the unit: 55 is fine in lb but not in kg.
  assert.equal(errorOf(fullBedForm({ tensionUnit: "kg", mainsTension: "13.6", crossesTension: "36.3" })), undefined);
  assert.equal(errorOf(fullBedForm({ tensionUnit: "kg", crossesTension: "13.5" })), "tension");
  assert.equal(errorOf(fullBedForm({ tensionUnit: "kg" })), "tension");
  assert.equal(errorOf(fullBedForm({ crossesTension: null })), "invalid");
});

test("gauges are 1.00–1.50 mm with at most 2 decimal places", () => {
  for (const gauge of ["1", "1.00", "1.5", "1.25", "1.250"]) {
    assert.equal(errorOf(fullBedForm({ mainsGauge: gauge })), undefined, gauge);
  }
  for (const gauge of ["0.99", "1.51", "1.255", "125", ""]) {
    assert.equal(errorOf(fullBedForm({ mainsGauge: gauge })), "gauge", gauge);
  }
});

test("the date strung is a real date, not in the future", () => {
  assert.equal(parseStrungOn("2024-02-29", NOW), "2024-02-29");
  for (const date of ["2023-02-29", "2026-13-01", "2026-04-31", "2026-9-1", "01/09/2026", ""]) {
    assert.equal(parseStrungOn(date, NOW), "date", date);
  }
  assert.equal(parseStrungOn(null, NOW), null);
});

test("today counts as not in the future in every time zone", () => {
  // 23:30 UTC on the 28th is already the 29th in Lisbon (UTC+1) and in Kiribati (UTC+14).
  const lateOn28th = new Date("2026-09-28T23:30:00Z");
  assert.equal(parseStrungOn("2026-09-29", lateOn28th), "2026-09-29");
  assert.equal(parseStrungOn("2026-09-30", lateOn28th), "date");
  // 10:00 UTC on the 29th is midnight on the 30th in Kiribati.
  assert.equal(parseStrungOn("2026-09-30", NOW), "2026-09-30");
  assert.equal(parseStrungOn("2026-10-01", NOW), "date");
});

test("every score is a whole number from 1 to 10", () => {
  for (const score of ["0", "11", "7.5", "7.0", "", "seven", "-1"]) {
    assert.equal(errorOf(fullBedForm({ spin: score })), "scores", score);
  }
  // Leaving a criterion out isn't allowed either (Product rule 4).
  assert.equal(errorOf(fullBedForm({ feel: null })), "scores");
  assert.equal(errorOf(fullBedForm({ power: "10", control: "1" })), undefined);
});

test("the written review is optional, trimmed, and capped", () => {
  const scores = { power: "7", control: "8", comfort: "6", spin: "9", feel: "7" };
  const body = (value: string | null) => {
    const formData = new FormData();
    for (const [name, score] of Object.entries(scores)) formData.set(name, score);
    if (value !== null) formData.set("body", value);
    const result = parseReviewFields(formData);
    return result.ok ? result.value.body : result.error;
  };
  assert.equal(body(null), null);
  assert.equal(body(" \r\n\t "), null);
  assert.equal(body("  Crisp.\r\nLively.  "), "Crisp.\nLively.");
  // Line breaks count once, as the browser's maxLength counts them.
  const atCap = `${"a".repeat(REVIEW_BODY_MAX_LENGTH - 2)}\r\nb`;
  assert.equal(body(atCap), atCap.replace("\r\n", "\n"));
  assert.equal(body(`${atCap}c`), "invalid");
});

test("a racquet slug must look like one", () => {
  assert.equal(parseRacquetSlug(SLUG), SLUG);
  for (const slug of ["", "Yonex", "../account", "a b", null]) {
    assert.equal(parseRacquetSlug(slug), null, String(slug));
  }
});
