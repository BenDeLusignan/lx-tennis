import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { ALL_SETUPS_TAG, STRINGS_TAG } from "@/data/cache-tags";
import { getDb, type Transaction } from "@/db/client";
import { setup, string, STRING_TYPES as STORED_STRING_TYPES } from "@/db/schema";
import { qualified } from "@/db/sql";

/**
 * The shared string list (Product rule 14). Any logged-in reviewer can add
 * a string from the setup form, and edit or delete one; the writers here
 * refresh every page that shows strings.
 */

export type StringType = (typeof STORED_STRING_TYPES)[number];

/** Product rule 14's types, in its order, with the labels it uses. */
export const STRING_TYPES: readonly { value: StringType; label: string }[] = [
  { value: "polyester", label: "polyester" },
  { value: "co-polyester", label: "co-polyester" },
  { value: "multifilament", label: "multifilament" },
  { value: "synthetic-gut", label: "synthetic gut" },
  { value: "natural-gut", label: "natural gut" },
  { value: "kevlar-aramid", label: "Kevlar/aramid" },
];

/** A type's label, as the lists and pages show it. */
export function stringTypeLabel(type: StringType): string {
  return STRING_TYPES.find(({ value }) => value === type)?.label ?? type;
}

export interface TennisString {
  id: number;
  brand: string;
  name: string;
  type: StringType;
}

/** A string's editable fields, already trimmed and checked (`parseStringFields` in `src/forms/fields.ts`). */
export type StringFields = Omit<TennisString, "id">;

/**
 * `text` with its first character uppercased and everything after it left
 * exactly as typed (Ben: a string's first letter is always capitalised;
 * manufacturers write POLYTOUR PRO, Hyper-G, Mach-10, so the rest is never
 * lowercased or title-cased). Works on the first code point, so an accented
 * or non-Latin first letter is capitalised too ("école" becomes "École").
 * Only the very first character is looked at: a leading digit or symbol is
 * left alone, and the letter after it isn't promoted ("3m Tour", "(pro) Gut"
 * stay as typed). A letter whose uppercase is several characters (ß → "SS")
 * is left alone too, since that would change the spelling.
 */
export function capitalizeFirst(text: string): string {
  const [first] = text; // string iteration is by code point, not UTF-16 unit
  if (first === undefined) return text;
  const upper = first.toUpperCase();
  return Array.from(upper).length === 1 ? upper + text.slice(first.length) : text;
}

/**
 * Product rule 14's one exception to "named as the manufacturer writes them":
 * the first letter of the brand and of the name is always uppercase. Applied
 * by every writer and by the duplicate lookup below, the single place that
 * decides what is stored, so a caller that skips `parseStringFields` still
 * stores a capitalised string, and capitalisation can neither create a
 * duplicate nor hide one. Idempotent. A seed or migration that writes the
 * table directly must do the same (0008 does for the rows before it).
 */
function capitalizeStringFields<T extends Pick<StringFields, "brand" | "name">>(fields: T): T {
  return { ...fields, brand: capitalizeFirst(fields.brand), name: capitalizeFirst(fields.name) };
}

const stringColumns = {
  id: string.id,
  brand: string.brand,
  name: string.name,
  type: string.type,
};

// lower() so "hyper-g" sorts next to "Hyper-G", the same folding the unique index uses.
const byBrandThenName = [asc(sql`lower(${string.brand})`), asc(sql`lower(${string.name})`)];

/** Every string, by brand then name. */
export async function getStrings(): Promise<readonly TennisString[]> {
  "use cache";
  cacheLife("max");
  cacheTag(STRINGS_TAG);
  return getDb().select(stringColumns).from(string).orderBy(...byBrandThenName);
}

/** Every string, by brand then name, and whether a setup uses it (so it can't be deleted). */
export async function getStringsWithUsage(): Promise<readonly TennisStringWithUsage[]> {
  "use cache";
  cacheLife("max");
  cacheTag(STRINGS_TAG);
  const rows = await getDb()
    .select({ ...stringColumns, inUse: STRING_IN_USE })
    .from(string)
    .orderBy(...byBrandThenName);
  return rows.map((row) => ({ ...row, inUse: row.inUse === 1 }));
}

type TennisStringWithUsage = TennisString & { inUse: boolean };

export interface StringBrandSection {
  /** As the first of its strings spells it. */
  brand: string;
  strings: readonly TennisStringWithUsage[];
}

/**
 * `/strings`: every string with a setup (`inUse`) or without, in a section per
 * brand, brands and names alphabetical. Brands are grouped ignoring capitals,
 * as the sort and the unique index fold them, so "Solinco" and "solinco"
 * typed on two setup forms don't make two sections. Cached with the strings
 * tag, which every change to the list or to which strings are used refreshes.
 */
export async function getStringsByBrand(): Promise<readonly StringBrandSection[]> {
  "use cache";
  cacheLife("max");
  cacheTag(STRINGS_TAG);
  const rows = await getStringsWithUsage();
  const sections = new Map<string, TennisStringWithUsage[]>();
  for (const row of rows) {
    const key = row.brand.toLowerCase();
    const section = sections.get(key);
    if (section) section.push(row);
    else sections.set(key, [row]);
  }
  return [...sections.values()].map((strings) => ({ brand: strings[0].brand, strings }));
}

/**
 * Whether a setup uses the outer query's string. Two EXISTS rather than one
 * with OR, so each uses its own string-id index.
 */
const STRING_IN_USE = sql<number>`(
  EXISTS (SELECT 1 FROM ${setup} WHERE ${qualified(setup, setup.mainsStringId)} = ${qualified(string, string.id)})
  OR EXISTS (SELECT 1 FROM ${setup} WHERE ${qualified(setup, setup.crossesStringId)} = ${qualified(string, string.id)})
)`;

/**
 * The string with this brand and name ignoring case, or undefined. Compared
 * with SQLite's own lower(), as the unique index is, so this finds exactly
 * the strings an insert would collide with.
 */
export async function findStringByName(
  tx: Transaction,
  fields: Pick<StringFields, "brand" | "name">,
): Promise<TennisString | undefined> {
  // Capitalised like what would be stored, so the lookup matches exactly the
  // strings the insert would collide with (SQLite's lower() doesn't fold an
  // accented first letter, so an uncapitalised "école" wouldn't find "École").
  const { brand, name } = capitalizeStringFields(fields);
  const [row] = await tx
    .select(stringColumns)
    .from(string)
    .where(
      and(
        eq(sql`lower(${string.brand})`, sql`lower(${brand})`),
        eq(sql`lower(${string.name})`, sql`lower(${name})`),
      ),
    );
  return row;
}

export async function stringExists(tx: Transaction, id: number): Promise<boolean> {
  const [row] = await tx.select({ id: string.id }).from(string).where(eq(string.id, id));
  return row !== undefined;
}

/** Inside a write transaction that has already checked `findStringByName`. Returns the new id. */
export async function insertString(tx: Transaction, fields: StringFields): Promise<number> {
  const [row] = await tx
    .insert(string)
    .values(capitalizeStringFields(fields))
    .returning({ id: string.id });
  return row.id;
}

/** Only from a Server Action (it refreshes pages with `updateTag`). */
export async function updateString(
  id: number,
  fields: StringFields,
): Promise<"saved" | "not-found" | "string-exists"> {
  const stored = capitalizeStringFields(fields);
  const result = await getDb().transaction(async (tx) => {
    if (!(await stringExists(tx, id))) return "not-found";
    // Another string with this brand and name; the same one (fixing only its
    // capitals, say) is fine.
    // Capitalises again on purpose: it's idempotent, and the lookup must work for any caller.
    const clash = await findStringByName(tx, stored);
    if (clash && clash.id !== id) return "string-exists";
    await tx.update(string).set(stored).where(eq(string.id, id));
    return "saved";
  });
  if (result === "saved") {
    updateTag(STRINGS_TAG);
    // The new name shows on every setup card that uses the string.
    updateTag(ALL_SETUPS_TAG);
  }
  return result;
}

/**
 * Deletes a string no setup uses. An id that's already gone counts as
 * deleted, so a double-submitted Delete doesn't show an error. Only from a
 * Server Action (it refreshes pages with `updateTag`).
 */
export async function deleteString(id: number): Promise<"deleted" | "in-use"> {
  const result = await getDb().transaction(async (tx) => {
    // Checked here, not left to the RESTRICT foreign keys (which stay as the
    // backstop), so a string in use is a clear refusal rather than an error.
    const deleted = await tx
      .delete(string)
      .where(and(eq(string.id, id), sql`NOT ${STRING_IN_USE}`))
      .returning({ id: string.id });
    if (deleted.length > 0) return "deleted";
    return (await stringExists(tx, id)) ? "in-use" : "already-gone";
  });
  // Nothing on a racquet page changes: a string in use can't be deleted.
  if (result === "deleted") updateTag(STRINGS_TAG);
  return result === "in-use" ? "in-use" : "deleted";
}
