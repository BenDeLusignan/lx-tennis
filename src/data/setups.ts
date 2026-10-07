import "server-only";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import {
  ALL_SETUPS_TAG,
  RACQUET_USAGE_TAG,
  racquetSetupsTag,
  STRING_SETUPS_TAG,
  STRINGS_TAG,
} from "@/data/cache-tags";
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

/** The highest total a review can reach: every criterion scored 10 (Product rule 5). */
export const MAX_TOTAL_SCORE = CRITERIA.length * 10;

/**
 * A review's total across the five criteria (5–50). Worked out whenever it's
 * shown and never stored, so it can't disagree with the scores; every review
 * scores all five (Product rule 4), so it's always a real sum.
 */
export function totalScore(scores: Scores): number {
  return CRITERIA.reduce((sum, { key }) => sum + scores[key], 0);
}

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

/**
 * Every setup with this string in its mains, its crosses or both, newest
 * strung first, for `/strings/[id]`. A setup is one row, so a full bed (or a
 * hybrid of one string in two gauges) is listed once. An id no string has
 * gives an empty list, the same as a string no setup uses: the page checks
 * that the string exists first. Cached; a new setup or any review change
 * refreshes `STRING_SETUPS_TAG` (`refreshRacquetSetups`), a string edit
 * `ALL_SETUPS_TAG`.
 */
export async function getStringSetups(stringId: number): Promise<readonly Setup[]> {
  "use cache";
  cacheLife("max");
  cacheTag(STRING_SETUPS_TAG, ALL_SETUPS_TAG);
  return loadSetups(
    sql`(${eq(setup.mainsStringId, stringId)} OR ${eq(setup.crossesStringId, stringId)})`,
  );
}

/**
 * A new setup or a review change: refreshes the racquet's page and the
 * results of every string. Every write that changes what a setup card shows
 * goes through here, so `/strings/[id]` can't miss one.
 */
function refreshRacquetSetups(slug: string): void {
  updateTag(racquetSetupsTag(slug));
  updateTag(STRING_SETUPS_TAG);
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
  /**
   * The setup is already on the site (Product rule 2); nothing was written.
   * `reviewedByAuthor`: the reviewer already has a review on it, so there is
   * nothing for them to add and they can only update it.
   */
  | { status: "duplicate"; setupId: number; reviewedByAuthor: boolean }
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
 * comes back, with whether the reviewer has already reviewed it, so they can
 * add their review to it or update the one they have. Only from a Server
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
      if (existing) {
        // Read inside the same write transaction as the duplicate check, so
        // the two can't disagree: no second read outside it.
        const [mine] = await tx
          .select({ id: review.id })
          .from(review)
          .where(and(eq(review.setupId, existing.id), eq(review.reviewerId, author.id)));
        throw new Refusal({
          status: "duplicate",
          setupId: existing.id,
          reviewedByAuthor: mine !== undefined,
        });
      }

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

  refreshRacquetSetups(input.racquetSlug);
  // New strings join the list, and this setup's strings are now in use.
  updateTag(STRINGS_TAG);
  // The racquet now has a setup, so it can't be deleted.
  updateTag(RACQUET_USAGE_TAG);
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

  refreshRacquetSetups(found.racquetSlug);
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

  refreshRacquetSetups(found.racquetSlug);
  return { status: "updated", racquetSlug: found.racquetSlug };
}

export type DeleteReviewResult =
  /** `setupRemoved`: it was the setup's last review, so the setup went too. */
  | { status: "deleted"; racquetSlug: string; setupRemoved: boolean }
  /** The reviewer has no review of this setup; nothing was deleted. */
  | { status: "not-reviewed"; racquetSlug: string }
  | { status: "unknown-setup" };

/**
 * Deletes the reviewer's own review of a setup, so a setup entered under the
 * wrong racquet can be cleared away without one reviewer's mistake costing
 * the others their reviews. When it was the setup's last review, the setup
 * is deleted too: a setup with no reviews would be an empty card nobody can
 * tell apart from a real one. Only from a Server Action (it refreshes pages
 * with `updateTag`).
 *
 * The row is found by setup AND the reviewer from the session, never by a
 * review id from the request, so no input can point this at someone else's
 * review. The delete and the "any reviews left?" check share one write
 * transaction (`BEGIN IMMEDIATE`, so writers queue): a review added a moment
 * later can't slip in between and be deleted with the setup, and two last
 * reviewers deleting at once can't both miss that they were last. The
 * RESTRICT foreign key from `review` to `setup` stays as the backstop: a
 * stray review would fail the setup delete and roll everything back, rather
 * than vanish.
 *
 * The caller treats "unknown-setup" as done, as a double-submitted Delete
 * must not show an error (as `deleteString`).
 */
export async function deleteReview(setupId: number, author: Reviewer): Promise<DeleteReviewResult> {
  const result = await getDb().transaction(async (tx): Promise<DeleteReviewResult> => {
    const [found] = await tx
      .select({ racquetSlug: racquet.slug })
      .from(setup)
      .innerJoin(racquet, eq(racquet.id, setup.racquetId))
      .where(eq(setup.id, setupId));
    if (!found) return { status: "unknown-setup" };

    const deleted = await tx
      .delete(review)
      .where(and(eq(review.setupId, setupId), eq(review.reviewerId, author.id)))
      .returning({ id: review.id });
    if (deleted.length === 0) return { status: "not-reviewed", racquetSlug: found.racquetSlug };

    const [remaining] = await tx
      .select({ id: review.id })
      .from(review)
      .where(eq(review.setupId, setupId))
      .limit(1);
    if (remaining) return { status: "deleted", racquetSlug: found.racquetSlug, setupRemoved: false };

    await tx.delete(setup).where(eq(setup.id, setupId));
    return { status: "deleted", racquetSlug: found.racquetSlug, setupRemoved: true };
  });

  if (result.status === "deleted") {
    refreshRacquetSetups(result.racquetSlug);
    // Only a removed setup changes the string list: its strings may no longer be in use.
    if (result.setupRemoved) {
      updateTag(STRINGS_TAG);
      // The racquet may have no setup left, so it can be deleted again.
      updateTag(RACQUET_USAGE_TAG);
    }
  }
  return result;
}
