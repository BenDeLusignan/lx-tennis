import "server-only";
import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { ALL_SETUPS_TAG, racquetSetupsTag, STRINGS_TAG } from "@/data/cache-tags";
import type { Reviewer } from "@/data/reviewers";
import {
  findStringByName,
  insertString,
  stringExists,
  type StringFields,
  type TennisString,
} from "@/data/strings";
import { tensionTenthsInKg, type TensionUnit } from "@/data/units";
import { getDb, type Transaction } from "@/db/client";
import { racquet, review, reviewer, setup, string } from "@/db/schema";

/**
 * Setups and their reviews (Product rules 1–6). Numbers go in as the exact
 * integers the database stores (tenths of the unit, hundredths of a mm) and
 * come out as plain numbers (55.5 lb, 1.25 mm).
 */

/** Product rule 4's criteria, in its order: the score grid's rows. */
export const CRITERIA = [
  { key: "power", label: "Power" },
  { key: "control", label: "Control" },
  { key: "comfort", label: "Comfort" },
  { key: "spin", label: "Spin" },
  { key: "feel", label: "Feel" },
] as const satisfies readonly { key: string; label: string }[];

export type Criterion = (typeof CRITERIA)[number]["key"];

export type Scores = Record<Criterion, number>;

export interface SetupSide {
  string: TennisString;
  gaugeMm: number;
  /** As typed, in the setup's `tensionUnit`. */
  tension: number;
}

export interface SetupReview {
  reviewer: Reviewer;
  scores: Scores;
  body: string | null;
}

export interface Setup {
  id: number;
  racquetSlug: string;
  /** YYYY-MM-DD. */
  strungOn: string;
  tensionUnit: TensionUnit;
  /** Same string and gauge in the mains and crosses (it isn't stored; see `setup` in the schema). */
  fullBed: boolean;
  mains: SetupSide;
  crosses: SetupSide;
  /** By reviewer id, the grid's column order. Only reviewers who have reviewed it. */
  reviews: readonly SetupReview[];
}

const mainsString = alias(string, "mains_string");
const crossesString = alias(string, "crosses_string");

async function loadSetups(where: SQL): Promise<Setup[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: setup.id,
      racquetSlug: racquet.slug,
      strungOn: setup.strungOn,
      tensionUnit: setup.tensionUnit,
      mainsString: {
        id: mainsString.id,
        brand: mainsString.brand,
        name: mainsString.name,
        type: mainsString.type,
      },
      mainsGauge: setup.mainsGaugeHundredthsMm,
      mainsTension: setup.mainsTensionTenths,
      crossesString: {
        id: crossesString.id,
        brand: crossesString.brand,
        name: crossesString.name,
        type: crossesString.type,
      },
      crossesGauge: setup.crossesGaugeHundredthsMm,
      crossesTension: setup.crossesTensionTenths,
    })
    .from(setup)
    .innerJoin(racquet, eq(racquet.id, setup.racquetId))
    .innerJoin(mainsString, eq(mainsString.id, setup.mainsStringId))
    .innerJoin(crossesString, eq(crossesString.id, setup.crossesStringId))
    .where(where)
    // Newest stringing first; of two strung the same day, the one entered last.
    .orderBy(desc(setup.strungOn), desc(setup.id));
  if (rows.length === 0) return [];

  const reviewRows = await db
    .select({
      setupId: review.setupId,
      reviewer: { id: reviewer.id, username: reviewer.username, displayName: reviewer.displayName },
      scores: {
        power: review.power,
        control: review.control,
        comfort: review.comfort,
        spin: review.spin,
        feel: review.feel,
      },
      body: review.body,
    })
    .from(review)
    .innerJoin(reviewer, eq(reviewer.id, review.reviewerId))
    .where(
      inArray(
        review.setupId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(reviewer.id);

  return rows.map((row) => ({
    id: row.id,
    racquetSlug: row.racquetSlug,
    strungOn: row.strungOn,
    tensionUnit: row.tensionUnit,
    fullBed: row.mainsString.id === row.crossesString.id && row.mainsGauge === row.crossesGauge,
    mains: { string: row.mainsString, gaugeMm: row.mainsGauge / 100, tension: row.mainsTension / 10 },
    crosses: {
      string: row.crossesString,
      gaugeMm: row.crossesGauge / 100,
      tension: row.crossesTension / 10,
    },
    reviews: reviewRows
      .filter((reviewRow) => reviewRow.setupId === row.id)
      .map(({ reviewer, scores, body }) => ({ reviewer, scores, body })),
  }));
}

/**
 * A racquet's setups, newest strung first, each with its reviews. Cached, so
 * the racquet page prerenders its cards into the static shell; every write
 * below refreshes it. `cacheLife("max")` because the refresh is on demand:
 * there's nothing for a timer to pick up.
 */
export async function getRacquetSetups(slug: string): Promise<readonly Setup[]> {
  "use cache";
  cacheLife("max");
  cacheTag(racquetSetupsTag(slug), ALL_SETUPS_TAG);
  return loadSetups(eq(racquet.slug, slug));
}

/** One setup, or undefined. Not cached: call it at request time, inside `<Suspense>`. */
export async function getSetup(id: number): Promise<Setup | undefined> {
  const [found] = await loadSetups(eq(setup.id, id));
  return found;
}

/** Either an existing string's id or a new string to add to the list. */
export type StringChoice = { id: number } | { new: StringFields };

export interface NewSetupSide {
  string: StringChoice;
  gaugeHundredthsMm: number;
  tensionTenths: number;
}

export interface NewReview {
  scores: Scores;
  /** Trimmed; null for none. */
  body: string | null;
}

export interface NewSetupWithReview {
  racquetSlug: string;
  strungOn: string;
  tensionUnit: TensionUnit;
  /** For a full bed, the crosses already carry the mains' string and gauge. */
  mains: NewSetupSide;
  crosses: NewSetupSide;
  review: NewReview;
}

export type CreateSetupResult =
  | { status: "created"; setupId: number }
  | { status: "duplicate"; setupId: number }
  | { status: "unknown-racquet" }
  | { status: "unknown-string" }
  /** A new string whose brand and name, ignoring capitals, are already on the list. */
  | { status: "string-exists" }
  /** Both sides add the same new string, but with different types. */
  | { status: "conflicting-new-strings" };

/** Thrown inside the transaction to roll it back with a result for the caller. */
class Refusal extends Error {
  constructor(readonly result: CreateSetupResult) {
    super(result.status);
  }
}

/**
 * Adds a setup with the reviewer's review, plus any new strings, in one
 * transaction: if anything fails, nothing is left behind (no orphan string).
 * A setup that's already on the site (Product rule 2) isn't added; its id
 * comes back so the reviewer can add their review to it. Only from a Server
 * Action (it refreshes pages with `updateTag`).
 */
export async function createSetupWithReview(
  input: NewSetupWithReview,
  author: Reviewer,
): Promise<CreateSetupResult> {
  let result: CreateSetupResult;
  try {
    result = await getDb().transaction(async (tx) => {
      const [racquetRow] = await tx
        .select({ id: racquet.id })
        .from(racquet)
        .where(eq(racquet.slug, input.racquetSlug));
      if (!racquetRow) throw new Refusal({ status: "unknown-racquet" });

      const mainsStringId = await resolveString(tx, input.mains.string);
      const crossesStringId =
        "new" in input.mains.string && "new" in input.crosses.string
          ? await resolveSecondNewString(tx, input.mains.string.new, mainsStringId, input.crosses.string.new)
          : await resolveString(tx, input.crosses.string);

      // A setup with a string that didn't exist a moment ago can't be a
      // duplicate, but the check is cheap and keeps this path single.
      const [existing] = await tx
        .select({ id: setup.id })
        .from(setup)
        .where(
          and(
            eq(setup.racquetId, racquetRow.id),
            eq(setup.strungOn, input.strungOn),
            eq(setup.mainsStringId, mainsStringId),
            eq(setup.mainsGaugeHundredthsMm, input.mains.gaugeHundredthsMm),
            // The unique index compares tensions in kg, so 55 lb and 24.9 kg match.
            eq(
              setup.mainsTensionTenthsKg,
              tensionTenthsInKg(input.mains.tensionTenths, input.tensionUnit),
            ),
            eq(setup.crossesStringId, crossesStringId),
            eq(setup.crossesGaugeHundredthsMm, input.crosses.gaugeHundredthsMm),
            eq(
              setup.crossesTensionTenthsKg,
              tensionTenthsInKg(input.crosses.tensionTenths, input.tensionUnit),
            ),
          ),
        );
      if (existing) throw new Refusal({ status: "duplicate", setupId: existing.id });

      const [created] = await tx
        .insert(setup)
        .values({
          racquetId: racquetRow.id,
          strungOn: input.strungOn,
          tensionUnit: input.tensionUnit,
          mainsStringId,
          mainsGaugeHundredthsMm: input.mains.gaugeHundredthsMm,
          mainsTensionTenths: input.mains.tensionTenths,
          crossesStringId,
          crossesGaugeHundredthsMm: input.crosses.gaugeHundredthsMm,
          crossesTensionTenths: input.crosses.tensionTenths,
          createdBy: author.id,
        })
        .returning({ id: setup.id });
      await tx.insert(review).values({
        setupId: created.id,
        reviewerId: author.id,
        ...input.review.scores,
        body: input.review.body,
      });
      return { status: "created", setupId: created.id };
    });
  } catch (error) {
    if (error instanceof Refusal) return error.result;
    throw error;
  }

  updateTag(racquetSetupsTag(input.racquetSlug));
  // New strings join the list, and this setup's strings are now in use.
  updateTag(STRINGS_TAG);
  return result;
}

async function resolveString(tx: Transaction, choice: StringChoice): Promise<number> {
  if ("id" in choice) {
    if (!(await stringExists(tx, choice.id))) throw new Refusal({ status: "unknown-string" });
    return choice.id;
  }
  if (await findStringByName(tx, choice.new)) throw new Refusal({ status: "string-exists" });
  return insertString(tx, choice.new);
}

/**
 * The crosses' new string when the mains added one too. The same brand and
 * name on both sides is one new string, as long as the types agree: a full
 * bed of a new string arrives like this, and so does a hybrid of one new
 * string in two gauges.
 */
async function resolveSecondNewString(
  tx: Transaction,
  mainsNew: StringFields,
  mainsStringId: number,
  crossesNew: StringFields,
): Promise<number> {
  const found = await findStringByName(tx, crossesNew);
  if (!found) return insertString(tx, crossesNew);
  if (found.id !== mainsStringId) throw new Refusal({ status: "string-exists" });
  if (crossesNew.type !== mainsNew.type) throw new Refusal({ status: "conflicting-new-strings" });
  return mainsStringId;
}

export type AddReviewResult =
  | { status: "created"; racquetSlug: string }
  | { status: "already-reviewed"; racquetSlug: string }
  | { status: "unknown-setup" };

/**
 * Adds the reviewer's review to an existing setup: one per reviewer per
 * setup (Product rule 2). Only from a Server Action (it refreshes pages with
 * `updateTag`).
 */
export async function addReview(
  setupId: number,
  newReview: NewReview,
  author: Reviewer,
): Promise<AddReviewResult> {
  const db = getDb();
  const [found] = await db
    .select({ racquetSlug: racquet.slug })
    .from(setup)
    .innerJoin(racquet, eq(racquet.id, setup.racquetId))
    .where(eq(setup.id, setupId));
  if (!found) return { status: "unknown-setup" };

  // One statement, so two submits at once can't both get in: the second
  // hits the unique (setup, reviewer) pair and inserts nothing.
  const inserted = await db
    .insert(review)
    .values({ setupId, reviewerId: author.id, ...newReview.scores, body: newReview.body })
    .onConflictDoNothing({ target: [review.setupId, review.reviewerId] })
    .returning({ id: review.id });
  if (inserted.length === 0) return { status: "already-reviewed", racquetSlug: found.racquetSlug };

  updateTag(racquetSetupsTag(found.racquetSlug));
  return { status: "created", racquetSlug: found.racquetSlug };
}

export type UpdateReviewResult =
  | { status: "updated"; racquetSlug: string }
  /** The reviewer has no review of this setup; nothing was written. */
  | { status: "not-reviewed"; racquetSlug: string }
  | { status: "unknown-setup" };

/**
 * Changes the scores and written review of the reviewer's own review of a
 * setup (only its original reviewer may edit it). Only from a Server Action
 * (it refreshes pages with `updateTag`).
 *
 * The row is found by setup AND the reviewer from the session, never by a
 * review id from the request, so no input can point this at someone else's
 * review; and it only updates, so a reviewer with no review gets
 * "not-reviewed" rather than a new one (adding is `addReview`'s job).
 */
export async function updateReview(
  setupId: number,
  changes: NewReview,
  author: Reviewer,
): Promise<UpdateReviewResult> {
  const db = getDb();
  const [found] = await db
    .select({ racquetSlug: racquet.slug })
    .from(setup)
    .innerJoin(racquet, eq(racquet.id, setup.racquetId))
    .where(eq(setup.id, setupId));
  if (!found) return { status: "unknown-setup" };

  // Drizzle sets `updated_at` on every update it runs (see the schema).
  const updated = await db
    .update(review)
    .set({ ...changes.scores, body: changes.body })
    .where(and(eq(review.setupId, setupId), eq(review.reviewerId, author.id)))
    .returning({ id: review.id });
  if (updated.length === 0) return { status: "not-reviewed", racquetSlug: found.racquetSlug };

  updateTag(racquetSetupsTag(found.racquetSlug));
  return { status: "updated", racquetSlug: found.racquetSlug };
}
