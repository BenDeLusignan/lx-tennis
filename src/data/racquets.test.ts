// Must be first: it sets up the test database and stands in for next/cache (see the file).
import "@/data/test-database";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BRANDS, getRacquet, getRacquetSlugs, getRacquetsByBrand, racquetSlugExists } from "@/data/racquets";

// The line-up as it was before the racquets moved into the database, from the
// old in-code array: the pages must show exactly this.
const EZONE = {
  slug: "yonex-ezone-98-2022",
  brand: "Yonex",
  name: "Yonex EZONE 98",
  year: 2022,
  generation: "7th gen",
  image: {
    src: "/images/racquets/yonex-ezone-98-2022.webp",
    width: 1000,
    height: 1500,
    alt: "Yonex EZONE 98 (2022) racquet in sky blue and navy, head up, face-on",
  },
  specs: {
    headSizeSqIn: 98,
    weightGrams: 305,
    weightOunces: 10.8,
    balanceMm: 315,
    lengthIn: 27,
    stringPattern: { mains: 16, crosses: 19 },
  },
  sourceUrl: "https://web.archive.org/web/20220129095929/https://www.yonex.com/tennis/racquets/ezone-98-07ez98",
};

test("the four line-up racquets come back from the database as they were in code", async () => {
  assert.deepEqual(await getRacquet("yonex-ezone-98-2022"), EZONE);
  assert.deepEqual(await getRacquetSlugs(), [
    "yonex-ezone-98-2022",
    "yonex-vcore-98-2023",
    "yonex-percept-97-2023",
    "babolat-pure-aero-98-2023",
  ]);
  const percept = await getRacquet("yonex-percept-97-2023");
  assert.equal(percept?.generation, null);
  assert.deepEqual(percept?.specs, {
    headSizeSqIn: 97,
    weightGrams: 310,
    weightOunces: 10.9,
    balanceMm: 310,
    lengthIn: 27,
    stringPattern: { mains: 16, crosses: 19 },
  });
  const aero = await getRacquet("babolat-pure-aero-98-2023");
  assert.equal(aero?.specs.weightOunces, 10.7586);
  assert.deepEqual(aero?.specs.stringPattern, { mains: 16, crosses: 20 });
  assert.equal(aero?.generation, "8th gen");
});

test("racquets are grouped into a section per brand in the fixed order, empty brands included", async () => {
  const sections = await getRacquetsByBrand();
  assert.deepEqual(sections.map((section) => section.brand), [...BRANDS]);
  assert.deepEqual(sections.map((section) => section.racquets.map((racquet) => racquet.slug)), [
    ["yonex-ezone-98-2022", "yonex-vcore-98-2023", "yonex-percept-97-2023"],
    ["babolat-pure-aero-98-2023"],
    [],
    [],
    [],
  ]);
});

test("an unknown slug has no racquet", async () => {
  assert.equal(await getRacquet("nope"), undefined);
  assert.equal(await racquetSlugExists("nope"), false);
  assert.equal(await racquetSlugExists("yonex-ezone-98-2022"), true);
});
