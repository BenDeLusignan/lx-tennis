import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { Button } from "@/components/button";
import { RacquetsByBrand } from "@/components/racquets-by-brand";
import { SectionTitle } from "@/components/section-title";
import { getRacquetsByBrand } from "@/data/racquets";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Racquets",
  description: "The racquets we've tested, with official specs and everyone's reviews.",
};

export default async function RacquetsPage() {
  const brands = await getRacquetsByBrand();

  return (
    <>
      {/* The row keeps a button's height whether or not "Add a racquet"
          streams in, so the brand sections below never jump. */}
      <div className={styles.header}>
        {/* Same look as the landing page's "Racquets" heading; h1 here because it's the page title. */}
        <SectionTitle as="h1" className={styles.title}>
          Racquets
        </SectionTitle>
        <Suspense fallback={null}>
          <AddRacquetButton />
        </Suspense>
      </div>
      <RacquetsByBrand sections={brands} headingLevel="h2" />
    </>
  );
}

// Reviewers only, and only a way in: the form's page and its action check
// the login for themselves (hiding this is cosmetic).
async function AddRacquetButton() {
  const reviewer = await getCurrentReviewer();
  if (!reviewer) return null;
  return <Button href="/account/racquets/new">Add a racquet</Button>;
}
