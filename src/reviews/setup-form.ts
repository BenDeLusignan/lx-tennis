import "server-only";
import { parseId, parseScaledDecimal, parseStringFields } from "@/forms/fields";
import { REVIEW_BODY_MAX_LENGTH } from "@/data/limits";
import {
  CRITERIA,
  type NewReview,
  type NewSetupSide,
  type NewSetupWithReview,
  type Scores,
  type StringChoice,
} from "@/data/setups";
import { GAUGE_LIMITS_MM, TENSION_LIMITS, type TensionUnit } from "@/data/units";

/**
 * Reads and checks the setup and review forms. Everything the database
 * checks is checked here first, so a reviewer gets a clear error code
 * instead of a failed insert; the database stays the backstop.
 *
 * A field that isn't in the form at all means a broken or hand-made request
 * ("invalid"), except where leaving it out is a normal answer: an unpicked
 * lb/kg choice ("unit") and an unanswered score ("scores"). A field that's
 * there but wrong gets its own code, so the page can say what to fix.
 */

export type SetupFormError = "invalid" | "unit" | "tension" | "gauge" | "date" | "scores";
export type ReviewFormError = "invalid" | "scores";

type Parsed<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function parseSetupForm(
  formData: FormData,
  racquetSlug: string,
  now: Date = new Date(),
): Parsed<NewSetupWithReview, SetupFormError> {
  const strungOn = parseStrungOn(formData.get("strungOn"), now);
  if (strungOn === null) return { ok: false, error: "invalid" };
  if (strungOn === "date") return { ok: false, error: "date" };

  const kind = formData.get("kind");
  if (kind !== "full-bed" && kind !== "hybrid") return { ok: false, error: "invalid" };

  const tensionUnit = formData.get("tensionUnit");
  if (tensionUnit !== "lb" && tensionUnit !== "kg") return { ok: false, error: "unit" };

  const mains = parseStringAndGauge(formData, "mains");
  if (!mains.ok) return mains;
  // A full bed is one string and gauge throughout (Product rule 1): the
  // crosses take the mains' and any crosses string or gauge in the form is
  // ignored. Stored this way, it reads back as a full bed by definition.
  const crosses = kind === "hybrid" ? parseStringAndGauge(formData, "crosses") : mains;
  if (!crosses.ok) return crosses;

  const mainsTension = parseTension(formData.get("mainsTension"), tensionUnit);
  if (!mainsTension.ok) return mainsTension;
  const crossesTension = parseTension(formData.get("crossesTension"), tensionUnit);
  if (!crossesTension.ok) return crossesTension;

  const review = parseReviewFields(formData);
  if (!review.ok) return review;

  return {
    ok: true,
    value: {
      racquetSlug,
      strungOn,
      tensionUnit,
      mains: { ...mains.value, tensionTenths: mainsTension.value },
      crosses: { ...crosses.value, tensionTenths: crossesTension.value },
      review: review.value,
    },
  };
}

/** The five scores and the optional written review, shared by both forms. */
export function parseReviewFields(formData: FormData): Parsed<NewReview, ReviewFormError> {
  const scores: Partial<Scores> = {};
  for (const { key } of CRITERIA) {
    const value = formData.get(key);
    // Whole numbers only (Product rule 5): "7.5", "7.0" and "07x" all fail.
    if (typeof value !== "string" || !/^\d{1,2}$/.test(value)) return { ok: false, error: "scores" };
    const score = Number(value);
    if (score < 1 || score > 10) return { ok: false, error: "scores" };
    scores[key] = score;
  }

  const body = formData.get("body");
  let text: string | null = null;
  if (body !== null) {
    if (typeof body !== "string") return { ok: false, error: "invalid" };
    // Browsers send a textarea's line breaks as CRLF but count them as one
    // character for `maxLength`, so normalise before measuring.
    text = body.replace(/\r\n?/g, "\n").trim() || null;
    if (text && text.length > REVIEW_BODY_MAX_LENGTH) return { ok: false, error: "invalid" };
  }

  return { ok: true, value: { scores: scores as Scores, body: text } };
}

/**
 * A real YYYY-MM-DD date that isn't in the future. Null if the field is
 * missing, "date" if it's there but not acceptable.
 *
 * "The future" is measured from the latest time zone on Earth (UTC+14), so
 * today is accepted wherever the reviewer is, even when it's still
 * yesterday on the server's clock.
 */
export function parseStrungOn(value: unknown, now: Date): string | null | "date" {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "date";
  const [year, month, day] = match.slice(1).map(Number);
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (daysInMonth === undefined || day < 1 || day > daysInMonth) return "date";

  const latestToday = new Date(now.getTime() + 14 * 60 * 60 * 1000).toISOString().slice(0, 10);
  // Same-length YYYY-MM-DD strings compare in date order.
  return value > latestToday ? "date" : value;
}

function parseStringAndGauge(
  formData: FormData,
  side: "mains" | "crosses",
): Parsed<Omit<NewSetupSide, "tensionTenths">, SetupFormError> {
  const string = parseStringChoice(formData, side);
  if (!string) return { ok: false, error: "invalid" };

  const gauge = formData.get(`${side}Gauge`);
  if (typeof gauge !== "string") return { ok: false, error: "invalid" };
  const hundredths = parseScaledDecimal(gauge, 2);
  if (
    typeof hundredths !== "number" ||
    hundredths < GAUGE_LIMITS_MM.min * 100 ||
    hundredths > GAUGE_LIMITS_MM.max * 100
  ) {
    return { ok: false, error: "gauge" };
  }
  return { ok: true, value: { string, gaugeHundredthsMm: hundredths } };
}

/** Tenths of `unit`, within Product rule 6's range. */
function parseTension(value: unknown, unit: TensionUnit): Parsed<number, SetupFormError> {
  if (typeof value !== "string") return { ok: false, error: "invalid" };
  const tenths = parseScaledDecimal(value, 1);
  const limits = TENSION_LIMITS[unit];
  // Rounded because the limits are floats: 13.6 * 10 needn't come out as exactly 136.
  if (
    typeof tenths !== "number" ||
    tenths < Math.round(limits.min * 10) ||
    tenths > Math.round(limits.max * 10)
  ) {
    return { ok: false, error: "tension" };
  }
  return { ok: true, value: tenths };
}

function parseStringChoice(formData: FormData, side: "mains" | "crosses"): StringChoice | null {
  const value = formData.get(`${side}String`);
  if (value === "new") {
    const fields = parseStringFields(
      formData.get(`${side}NewBrand`),
      formData.get(`${side}NewName`),
      formData.get(`${side}NewType`),
    );
    return fields && { new: fields };
  }
  const id = parseId(value);
  return id === null ? null : { id };
}
