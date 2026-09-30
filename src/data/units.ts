/**
 * Tension and gauge units (Product rules 1 and 6). Pure, with no
 * `server-only`, so client components can format and check values too.
 *
 * The database stores numbers as exact integers: tensions in tenths of the
 * setup's unit, gauges in hundredths of a mm. Everything here works in those
 * integers first, so a value never drifts through a float round trip.
 */

export type TensionUnit = "lb" | "kg";

/** The international pound, as in the `setup` table's generated kg columns. */
const KG_PER_LB = 0.45359237;

/** Accepted tensions (Product rule 6), up to 1 decimal place. The DB's range checks mirror these. */
export const TENSION_LIMITS: Readonly<Record<TensionUnit, { min: number; max: number }>> = {
  lb: { min: 30, max: 80 },
  kg: { min: 13.6, max: 36.3 },
};

/** Accepted gauges, up to 2 decimal places. The DB's range check mirrors this. */
export const GAUGE_LIMITS_MM = { min: 1, max: 1.5 } as const;

export function otherTensionUnit(unit: TensionUnit): TensionUnit {
  return unit === "lb" ? "kg" : "lb";
}

/**
 * A tension in tenths of `unit`, converted to tenths of a kg exactly as the
 * `setup` table's generated `*_tension_tenths_kg` columns do: the same
 * float product, rounded half up. The duplicate check compares on this
 * value, so it has to agree with the database for every accepted tension
 * (`units.test.ts` checks every one against a real database).
 */
export function tensionTenthsInKg(tenths: number, unit: TensionUnit): number {
  return unit === "kg" ? tenths : Math.round(tenths * KG_PER_LB);
}

/** The tension in the other unit, rounded to 1 decimal place. */
export function convertTension(value: number, from: TensionUnit): number {
  const tenths = Math.round(value * 10);
  const converted = from === "lb" ? tensionTenthsInKg(tenths, "lb") : Math.round(tenths / KG_PER_LB);
  return converted / 10;
}

/**
 * `{ typed: "55 lb", other: "24.9 kg" }`. The typed value reads as typed
 * (55 stays "55", not "55.0"); the other unit always has 1 decimal place
 * (Product rule 6), so 53 lb is "24.0 kg".
 */
export function formatTension(value: number, unit: TensionUnit): { typed: string; other: string } {
  return {
    typed: `${Math.round(value * 10) / 10} ${unit}`,
    other: `${convertTension(value, unit).toFixed(1)} ${otherTensionUnit(unit)}`,
  };
}

/** "1.25 mm", "1.30 mm": always 2 decimal places, the way string brands print gauges. */
export function formatGauge(mm: number): string {
  return `${mm.toFixed(2)} mm`;
}
