/**
 * Racquet catalogue.
 *
 * Pages only ever talk to the async accessors at the bottom of this file
 * (`getRacquetsByBrand`, `getRacquet`, `getRacquetSlugs`). When the data
 * moves to a database, swap the bodies of those functions for queries and
 * leave the pages alone.
 *
 * Specs are copied from the manufacturer's official product pages only.
 * Every racquet carries the same five specs (Product rule 11); extras a
 * manufacturer publishes, such as Babolat's swingweight or stiffness, are
 * deliberately not stored, and one of the five it doesn't publish would be
 * left out rather than guessed or converted. The official pages for these
 * generations have since been replaced by newer models, so each source is
 * also given as an Internet Archive snapshot of the official page.
 *
 * Images are the manufacturer's official face-on product shots (launch
 * colourway), downloaded into /public/images/racquets, trimmed, scaled to the
 * same 1410px frame height (every racquet here is 27 in long) and centred at
 * the top of an identical 1000x1500 transparent canvas, so every racquet
 * shares the same scale.
 */

/** Brands in display order. Every brand gets a section, even with no racquets. */
export const BRANDS = ["Yonex", "Babolat", "Head", "Tecnifibre", "Wilson"] as const;
export type Brand = (typeof BRANDS)[number];

export interface RacquetSpecs {
  /** Head size in square inches. */
  headSizeSqIn: number;
  /** Frame weight as published by the manufacturer (frames are sold unstrung). */
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
  brand: Brand;
  /**
   * Full name, which must start with `brand`, e.g. "Yonex EZONE 98". Cards
   * under a brand heading strip the brand off (`modelName` in racquet-list.tsx).
   */
  name: string;
  /** Model year of this generation. */
  year: number;
  /** Generation label where the manufacturer's page states it, e.g. "7th gen". */
  generation?: string;
  image: RacquetImage;
  specs: RacquetSpecs;
}

const IMAGE_SIZE = { width: 1000, height: 1500 } as const;

/** Racquets within a brand display in the order of this array. */
const racquets: readonly Racquet[] = [
  {
    // Specs: official Yonex product page, item code 07EZ98
    //   https://www.yonex.com/tennis/racquets/ezone-98-07ez98
    //   Archived: https://web.archive.org/web/20220129095929/https://www.yonex.com/tennis/racquets/ezone-98-07ez98
    //   (same values for these specs in https://web.archive.org/web/20240810100806/https://www.yonex.com/tennis/racquets/ezone-98-07ez98)
    // Image: Sky Blue launch colourway, listed on the page above
    //   https://www.yonex.com/media/catalog/product/0/7/07ez98.png
    slug: "yonex-ezone-98-2022",
    brand: "Yonex",
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
    brand: "Yonex",
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
    brand: "Yonex",
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
  {
    // Specs: official Babolat US product page, item 101499 (unstrung)
    //   https://www.babolat.com/us/pure-aero-98-unstrung/101499.html
    //   Archived: https://web.archive.org/web/20230203095246/https://www.babolat.com/us/pure-aero-98-unstrung/101499.html
    //   The US page is the one that publishes the imperial values (98 in², 27 in, 10.7586 oz);
    //   the UK/FR pages give metric only. Weight and balance are published as ±7 g / ±7 mm;
    //   the site shows the nominal value only.
    // Generation: "eighth-generation" on the official UK page for the same item
    //   Archived: https://web.archive.org/web/20230127021819/https://www.babolat.com/gb/pure-aero-98-unstrung/101499.html
    // Image: Grey Yellow White launch colourway (code 370), face-on shot from the US page above
    //   https://media.babolat.com/image/upload/v1651570894/Product_Media/2023/TENNIS_RACKETS/EXPERT/101499-Pure_Aero_98-370-1-Face.png
    slug: "babolat-pure-aero-98-2023",
    brand: "Babolat",
    name: "Babolat Pure Aero 98",
    year: 2023,
    generation: "8th gen",
    image: {
      src: "/images/racquets/babolat-pure-aero-98-2023.webp",
      ...IMAGE_SIZE,
      alt: "Babolat Pure Aero 98 (2023) racquet in grey, neon yellow and white, head up, face-on",
    },
    specs: {
      headSizeSqIn: 98,
      // Babolat publishes the ounces to four decimals; kept as published. The racquet
      // page rounds to 1 dp for display (`oneDecimal` in racquets/[slug]/page.tsx).
      unstrungWeight: { grams: 305, ounces: 10.7586 },
      balanceMm: 315,
      lengthIn: 27,
      stringPattern: { mains: 16, crosses: 20 },
    },
  },
];

export interface BrandSection {
  brand: Brand;
  racquets: readonly Racquet[];
}

/** Every brand in BRANDS order, including brands with no racquets; racquets in array order. */
export async function getRacquetsByBrand(): Promise<readonly BrandSection[]> {
  return BRANDS.map((brand) => ({
    brand,
    racquets: racquets.filter((racquet) => racquet.brand === brand),
  }));
}

export async function getRacquet(slug: string): Promise<Racquet | undefined> {
  return racquets.find((racquet) => racquet.slug === slug);
}

export async function getRacquetSlugs(): Promise<string[]> {
  return racquets.map((racquet) => racquet.slug);
}
