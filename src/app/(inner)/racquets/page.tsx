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
        {/* h1 because it's the page title; the brand sections below are h2. */}
        <SectionTitle as="h1" className={styles.title}>
          Racquets
        </SectionTitle>
        <Suspense fallback={null}>
          <AddRacquetButton />
        </Suspense>
      </div>
      <p className={styles.intro}>
        Racquets and string setups we&rsquo;ve tested, with everyone&rsquo;s scores side by side.
      </p>
      <RacquetsByBrand sections={brands} />
      <p className={styles.sourceNote}>
        Racquet photos and specs from the manufacturers&rsquo; official product pages.
      </p>
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
