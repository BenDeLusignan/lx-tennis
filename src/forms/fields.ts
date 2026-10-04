import "server-only";
import { EMAIL_MAX_LENGTH, STRING_FIELD_MAX_LENGTH } from "@/data/limits";
import { STRING_TYPES, type StringFields } from "@/data/strings";

/**
 * Parsing for Server Action form fields. Server Actions are public POST
 * endpoints, so every field is `unknown` until checked here: it may be
 * missing, a File, or anything a hand-made request sends.
 */

/** A positive whole-number id (`"12"`), or null. */
export function parseId(value: unknown): number | null {
  // Ten digits keeps it far inside a safe integer and SQLite's 64-bit range.
  if (typeof value !== "string" || !/^[1-9]\d{0,9}$/.test(value)) return null;
  return Number(value);
}

/**
 * A decimal like "55.5" as an exact integer in units of 10^-`places` (so
 * "55.5" with 1 place is 555), without going through a float. Trailing zeros
 * don't count as places: "55.50" is 555 too. "too-precise" for more places
 * than allowed, null for anything that isn't a plain decimal.
 */
export function parseScaledDecimal(value: unknown, places: number): number | "too-precise" | null {
  // The length cap keeps the regex and Number() on short input.
  if (typeof value !== "string" || value.length > 20) return null;
  const match = /^\s*(\d+)(?:\.(\d*?)0*)?\s*$/.exec(value);
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  if (fraction.length > places) return "too-precise";
  return Number(whole + fraction.padEnd(places, "0"));
}

/**
 * A string's brand, name and type, checked the way the `string` table checks
 * them: trimmed and not blank, within the length cap, and a type from
 * Product rule 14's list. Null if any fails. Whether the brand and name are
 * already taken needs the database, so the writer checks that.
 */
export function parseStringFields(brand: unknown, name: unknown, type: unknown): StringFields | null {
  if (typeof brand !== "string" || typeof name !== "string") return null;
  // JavaScript's trim() strips every kind of whitespace, a superset of what
  // the table's check strips, so a trimmed value always passes it.
  const trimmedBrand = brand.trim();
  const trimmedName = name.trim();
  if (!trimmedBrand || trimmedBrand.length > STRING_FIELD_MAX_LENGTH) return null;
  if (!trimmedName || trimmedName.length > STRING_FIELD_MAX_LENGTH) return null;
  const stringType = STRING_TYPES.find((option) => option.value === type)?.value;
  if (!stringType) return null;
  return { brand: trimmedBrand, name: trimmedName, type: stringType };
}

/**
 * An email address, checked the way the account page's rule wants it: one
 * `@` with something on either side, a dot in the domain, no spaces, at
 * most `EMAIL_MAX_LENGTH`. Trimmed and lowercased, the form the reviewer
 * table stores (its checks pin trimmed and the length; the unique index
 * folds case, see `src/db/schema.ts`). Deliberately not a full RFC 5322
 * grammar check: this only needs to be an address a human can read back
 * and that a future password-reset mail can reach. Null if any check fails.
 */
export function parseEmail(value: unknown): string | null {
  // The length cap bounds the string work before it starts.
  if (typeof value !== "string" || value.length > EMAIL_MAX_LENGTH) return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX_LENGTH) return null;
  if (email.includes(" ")) return null;
  // Exactly one @, with a non-empty local part before it.
  const at = email.indexOf("@");
  if (at < 1 || email.indexOf("@", at + 1) !== -1) return null;
  // The domain has a dot with a character on each side ("x.com"), so "a@b"
  // and "a@.com" are out but "ben+tag@example.co.uk" is in.
  const domain = email.slice(at + 1);
  const dot = domain.indexOf(".");
  if (dot < 1 || dot === domain.length - 1) return null;
  return email;
}
