import type { Metadata } from "next";
import { RacquetsByBrand } from "@/components/racquets-by-brand";
import { SectionTitle } from "@/components/section-title";
import { getRacquetsByBrand } from "@/data/racquets";

export const metadata: Metadata = {
  title: "Racquets",
  description: "The racquets we've tested, with official specs and everyone's reviews.",
};

export default async function RacquetsPage() {
  const brands = await getRacquetsByBrand();

  return (
    <>
      {/* Same look as the landing page's "Racquets" heading; h1 here because it's the page title. */}
      <SectionTitle as="h1">Racquets</SectionTitle>
      <RacquetsByBrand sections={brands} headingLevel="h2" />
    </>
  );
}
