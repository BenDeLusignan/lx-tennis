import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { loginPath } from "@/auth/safe-next-path";
import { BackLink } from "@/components/back-link";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { FormMessage } from "@/components/form-message";
import { RACQUET_ERROR_MESSAGES } from "@/components/racquet-error-messages";
import { RacquetPhoto } from "@/components/racquet-photo";
import { SectionTitle } from "@/components/section-title";
import { getRacquetsByBrandWithUsage, type BrandSection, type RacquetWithUsage } from "@/data/racquets";
import { editRacquetPath, RACQUETS_ADMIN_PATH, racquetModel } from "@/racquets/racquet-form";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Racquets",
  description: "Edit or delete the racquets on the LX Tennis list.",
};

// The list is cached and refreshed on every change, so it's in the static
// shell; only the login check and the result of the last change stream in.
export default async function RacquetsAdminPage({ searchParams }: PageProps<"/account/racquets">) {
  const sections = await getRacquetsByBrandWithUsage();

  return (
    <div className={styles.page}>
      <div>
        <BackLink href="/account">Your account</BackLink>
        <SectionTitle as="h1">Racquets</SectionTitle>
        <p className={styles.intro}>
          Every racquet on the site, grouped by brand. Fix a brand, model, year, spec or photo, and
          the change shows wherever the racquet does. A racquet&rsquo;s page address never changes,
          so links to it keep working. A racquet can only be deleted while no setup uses it.
        </p>
      </div>

      <Suspense fallback={null}>
        <Status searchParams={searchParams} sections={sections} />
      </Suspense>

      <div className={styles.brands}>
        {sections.map(({ brand, racquets }) => {
          const headingId = `brand-${brand.toLowerCase().replace(/\s+/g, "-")}`;
          return (
            <section key={brand} aria-labelledby={headingId}>
              <SectionTitle as="h2" id={headingId} size="lg">
                {brand}
              </SectionTitle>
              {racquets.length > 0 ? (
                <ul className={styles.list}>
                  {racquets.map((racquet) => (
                    <RacquetRow key={racquet.slug} racquet={racquet} />
                  ))}
                </ul>
              ) : (
                <EmptyState title="No racquets yet" size="compact" />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// Edit is a plain link to the racquet's own page: a racquet has a photo and a
// dozen fields, too much to open inline the way a string's three fields do.
// Delete lives on that page (the confirmation sits with the racquet it
// deletes), so a row only says whether a delete would be allowed.
function RacquetRow({ racquet }: { racquet: RacquetWithUsage }) {
  const nameId = `${racquet.slug}-name`;
  const editId = `${racquet.slug}-edit`;

  return (
    <li className={styles.row}>
      {/* `sizes` matches `.photo` in page.module.css (a fixed 3.5rem). */}
      <RacquetPhoto image={racquet.image} sizes="3.5rem" className={styles.photo} />
      <div className={styles.text}>
        {/* The brand heading above already names the brand; screen readers
            still get it, since they list headings and links out of context. */}
        <h3 id={nameId} className={styles.name}>
          <span className="visually-hidden">{racquet.brand} </span>
          {racquetModel(racquet)}
        </h3>
        <span className={styles.meta}>
          {racquet.generation ? `${racquet.year} · ${racquet.generation}` : racquet.year}
          {racquet.inUse && <span className={styles.inUse}>Tested in a review</span>}
        </span>
      </div>
      <Button
        id={editId}
        href={editRacquetPath(racquet.slug)}
        aria-labelledby={`${editId} ${nameId}`}
        className={styles.edit}
      >
        Edit
      </Button>
    </li>
  );
}

// The page's own login check (the proxy's is only the quick one), and the
// result of the last save or delete.
async function Status({
  searchParams,
  sections,
}: Pick<PageProps<"/account/racquets">, "searchParams"> & {
  sections: readonly BrandSection<RacquetWithUsage>[];
}) {
  const reviewer = await getCurrentReviewer();
  if (!reviewer) redirect(loginPath(RACQUETS_ADMIN_PATH));

  const { saved, deleted, error } = await searchParams;
  // A fresh key per response, so the same message twice is focused again.
  const key = crypto.randomUUID();

  if (error === "not-found") {
    return (
      <FormMessage key={key} tone="error">
        {RACQUET_ERROR_MESSAGES["not-found"]} Nothing was changed.
      </FormMessage>
    );
  }
  if (deleted === "1") {
    return (
      <FormMessage key={key} tone="success">
        Racquet deleted.
      </FormMessage>
    );
  }
  const savedRacquet = sections
    .flatMap((section) => section.racquets)
    .find((racquet) => racquet.slug === saved);
  if (savedRacquet) {
    return (
      <FormMessage key={key} tone="success">
        Saved {savedRacquet.name}.
      </FormMessage>
    );
  }
  return null;
}
