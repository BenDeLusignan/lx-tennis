import assert from "node:assert/strict";
import { test } from "node:test";
import { RACQUET_SLUG_MAX_LENGTH } from "@/data/limits";
import { parseRacquetSlug } from "@/racquets/racquet-form";

const SLUG = "yonex-ezone-98-2022";

test("a racquet slug must look like one", () => {
  assert.equal(parseRacquetSlug(SLUG), SLUG);
  for (const slug of ["", "Yonex", "../account", "a b", null]) {
    assert.equal(parseRacquetSlug(slug), null, String(slug));
  }
});

test("a racquet slug is at most RACQUET_SLUG_MAX_LENGTH characters", () => {
  const longest = "a".repeat(RACQUET_SLUG_MAX_LENGTH);
  assert.equal(parseRacquetSlug(longest), longest);
  assert.equal(parseRacquetSlug(`${longest}a`), null);
});
