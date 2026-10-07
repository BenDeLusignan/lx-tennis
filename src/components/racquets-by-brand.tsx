import type { ComponentProps } from "react";
import { EmptyState } from "@/components/empty-state";
import { RacquetList } from "@/components/racquet-list";
import { SectionTitle } from "@/components/section-title";
import type { BrandSection } from "@/data/racquets";
import styles from "./racquets-by-brand.module.css";

interface RacquetsByBrandProps {
  sections: readonly BrandSection[];
  /** Passed to every `RacquetList`: where a card goes and its call to action. */
  hrefFor?: ComponentProps<typeof RacquetList>["hrefFor"];
  cta?: string;
}

/**
 * One section per brand (Product rule 13), in the order `getRacquetsByBrand()`
 * returns them, with an honest empty state for a brand we haven't tested yet.
 * Used on `/racquets` and on the Add a review chooser, under their h1: brand
 * names are h2, racquet names h3.
 */
export function RacquetsByBrand({ sections, hrefFor, cta }: RacquetsByBrandProps) {
  return (
    <div className={styles.brands}>
      {sections.map(({ brand, racquets }) => {
        const headingId = `brand-${brand.toLowerCase().replace(/\s+/g, "-")}`;
        return (
          <section key={brand} aria-labelledby={headingId}>
            <SectionTitle as="h2" id={headingId} size="lg">
              {brand}
            </SectionTitle>
            {racquets.length > 0 ? (
              <RacquetList racquets={racquets} hrefFor={hrefFor} cta={cta} />
            ) : (
              <EmptyState title="No racquets yet" size="compact" />
            )}
          </section>
        );
      })}
    </div>
  );
}
