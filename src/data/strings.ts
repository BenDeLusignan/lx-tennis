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

export interface TennisString {
  id: number;
  brand: string;
  name: string;
  type: StringType;
}

/** A string's editable fields, already trimmed and checked (`parseStringFields` in `src/forms/fields.ts`). */
export type StringFields = Omit<TennisString, "id">;

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
export async function getStringsWithUsage(): Promise<readonly (TennisString & { inUse: boolean })[]> {
  "use cache";
  cacheLife("max");
  cacheTag(STRINGS_TAG);
  const rows = await getDb()
    .select({ ...stringColumns, inUse: STRING_IN_USE })
    .from(string)
    .orderBy(...byBrandThenName);
  return rows.map((row) => ({ ...row, inUse: row.inUse === 1 }));
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
  { brand, name }: Pick<StringFields, "brand" | "name">,
): Promise<TennisString | undefined> {
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
  const [row] = await tx.insert(string).values(fields).returning({ id: string.id });
  return row.id;
}

/** Only from a Server Action (it refreshes pages with `updateTag`). */
export async function updateString(
  id: number,
  fields: StringFields,
): Promise<"saved" | "not-found" | "string-exists"> {
  const result = await getDb().transaction(async (tx) => {
    if (!(await stringExists(tx, id))) return "not-found";
    // Another string with this brand and name; the same one (fixing only its
    // capitals, say) is fine.
    const clash = await findStringByName(tx, fields);
    if (clash && clash.id !== id) return "string-exists";
    await tx.update(string).set(fields).where(eq(string.id, id));
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
