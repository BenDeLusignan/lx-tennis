import type { Metadata } from "next";
import { RacquetList } from "@/components/racquet-list";
import { SectionTitle } from "@/components/section-title";
import { getRacquets } from "@/data/racquets";

export const metadata: Metadata = {
  title: "Racquets",
  description: "The racquets we've tested, with official specs and everyone's reviews.",
};

export default async function RacquetsPage() {
  const racquets = await getRacquets();

  return (
    <>
      {/* Same look as the landing page's "Racquets" heading; h1 here because it's the page title. */}
      <SectionTitle as="h1">Racquets</SectionTitle>
      <RacquetList racquets={racquets} headingLevel="h2" />
    </>
  );
}
