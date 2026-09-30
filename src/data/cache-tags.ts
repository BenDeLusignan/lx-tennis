import "server-only";

/**
 * Cache tags for the `'use cache'` accessors in `src/data`, in one place so
 * a reader's `cacheTag` and a writer's `updateTag` can't drift apart.
 *
 * Racquet pages are prerendered with their setup cards in the static shell.
 * A tag set inside a cached accessor is carried up to the prerendered page
 * as well, so `updateTag` on it expires the page itself, not only the data,
 * and the next request renders a fresh page (it waits for fresh data rather
 * than serving the old one).
 *
 * The writers in `src/data` call `updateTag` themselves after they commit
 * (Freshness), so a new way of changing data can't forget the refresh. That
 * also means they can only be called from a Server Action: `updateTag`
 * throws anywhere else.
 */

/** One racquet's setups, reviews included: `getRacquetSetups(slug)`. */
export function racquetSetupsTag(slug: string): string {
  return `setups:${slug}`;
}

/**
 * Every racquet's setups. Only a string edit uses it: the cards show string
 * names, and one string can be on any number of racquets. Refreshing them
 * all is simpler than working out which ones use it, can't miss one, and
 * costs a re-render of a handful of pages on a rare edit.
 */
export const ALL_SETUPS_TAG = "setups";

/**
 * The string list and which strings are in use: `getStrings()` and
 * `getStringsWithUsage()`. Refreshed by any string change, by every new
 * setup (it may add strings, and it puts its strings in use) and by a
 * review delete that removes its setup (its strings may no longer be in use).
 */
export const STRINGS_TAG = "strings";
