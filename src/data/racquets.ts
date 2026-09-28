/**
 * Racquet catalogue.
 *
 * Pages only ever talk to the async accessors at the bottom of this file
 * (`getRacquets`, `getRacquet`, `getRacquetSlugs`). When the data moves to a
 * database, swap the bodies of those functions for queries and leave the
 * pages alone.
 *
 * Specs are copied from Yonex's official product pages only. A spec that
 * Yonex does not publish (e.g. stiffness/RA, swingweight) is deliberately
 * absent rather than guessed. The yonex.com product pages for these
 * generations have since been replaced by newer models, so each source is
 * also given as an Internet Archive snapshot of the official page.
 *
 * Images are Yonex's official face-on product shots (launch colourway),
 * downloaded into /public/images/racquets, trimmed and centred on an identical
 * 1000x1500 transparent canvas so every racquet shares the same scale.
 */

export interface RacquetSpecs {
  /** Head size in square inches. */
  headSizeSqIn: number;
  /** Frame weight as published by Yonex (frames are sold unstrung). */
  unstrungWeight: { grams: number; ounces: number };
  /** Balance point in millimetres from the butt cap. */
  balanceMm: number;
  lengthIn: number;
  stringPattern: { mains: number; crosses: number };
}

export interface RacquetImage {
  /** Path under /public. */
  src: string;
  width: number;
  height: number;
  alt: string;
}

export interface Racquet {
  /** URL slug, also the primary key. */
  slug: string;
  name: string;
  /** Model year of this generation. */
  year: number;
  /** Generation label where Yonex numbers it, e.g. "7th gen". */
  generation?: string;
  image: RacquetImage;
  specs: RacquetSpecs;
}

const IMAGE_SIZE = { width: 1000, height: 1500 } as const;

/** Display order is the order of this array. */
const racquets: readonly Racquet[] = [
  {
    // Specs: official Yonex product page, item code 07EZ98
    //   https://www.yonex.com/tennis/racquets/ezone-98-07ez98
    //   Archived: https://web.archive.org/web/20220129095929/https://www.yonex.com/tennis/racquets/ezone-98-07ez98
    //   (same values for these specs in https://web.archive.org/web/20240810100806/https://www.yonex.com/tennis/racquets/ezone-98-07ez98)
    // Image: Sky Blue launch colourway, listed on the page above
    //   https://www.yonex.com/media/catalog/product/0/7/07ez98.png
    slug: "yonex-ezone-98-2022",
    name: "Yonex EZONE 98",
    year: 2022,
    generation: "7th gen",
    image: {
      src: "/images/racquets/yonex-ezone-98-2022.webp",
      ...IMAGE_SIZE,
      alt: "Yonex EZONE 98 (2022) racquet in sky blue and navy, head up, face-on",
    },
    specs: {
      headSizeSqIn: 98,
      unstrungWeight: { grams: 305, ounces: 10.8 },
      balanceMm: 315,
      lengthIn: 27,
      stringPattern: { mains: 16, crosses: 19 },
    },
  },
  {
    // Specs: official Yonex product page, item code 07VC98
    //   https://www.yonex.com/tennis/racquets/vcore/07vc98
    //   Archived: https://web.archive.org/web/20250123005803/https://www.yonex.com/tennis/racquets/vcore/07vc98
    // Image: Scarlet launch colourway, from Yonex USA's 07VC98 product page
    //   https://us.yonex.com/cdn/shop/files/07vc98_in_02.png
    //   (page: https://web.archive.org/web/20250317040121/https://us.yonex.com/products/vcore-98)
    slug: "yonex-vcore-98-2023",
    name: "Yonex VCORE 98",
    year: 2023,
    generation: "7th gen",
    image: {
      src: "/images/racquets/yonex-vcore-98-2023.webp",
      ...IMAGE_SIZE,
      alt: "Yonex VCORE 98 (2023) racquet in scarlet red, head up, face-on",
    },
    specs: {
      headSizeSqIn: 98,
      unstrungWeight: { grams: 305, ounces: 10.8 },
      balanceMm: 315,
      lengthIn: 27,
      stringPattern: { mains: 16, crosses: 19 },
    },
  },
  {
    // Specs: official Yonex product page, item code 01PE97
    //   https://www.yonex.com/tennis/racquets/percept-97
    //   Archived: https://web.archive.org/web/20240722194555/https://www.yonex.com/tennis/racquets/percept-97
    //   Head size, balance, length and pattern also current on https://us.yonex.com/products/percept-97
    // Image: Olive Green launch colourway, listed on the yonex.com page above
    //   https://www.yonex.com/media/catalog/product/i/n/int_01pe97_268-1_1.png
    slug: "yonex-percept-97-2023",
    name: "Yonex PERCEPT 97",
    year: 2023,
    image: {
      src: "/images/racquets/yonex-percept-97-2023.webp",
      ...IMAGE_SIZE,
      alt: "Yonex PERCEPT 97 (2023) racquet in olive green, head up, face-on",
    },
    specs: {
      headSizeSqIn: 97,
      unstrungWeight: { grams: 310, ounces: 10.9 },
      balanceMm: 310,
      lengthIn: 27,
      stringPattern: { mains: 16, crosses: 19 },
    },
  },
];

export async function getRacquets(): Promise<readonly Racquet[]> {
  return racquets;
}

export async function getRacquet(slug: string): Promise<Racquet | undefined> {
  return racquets.find((racquet) => racquet.slug === slug);
}

export async function getRacquetSlugs(): Promise<string[]> {
  return racquets.map((racquet) => racquet.slug);
}
