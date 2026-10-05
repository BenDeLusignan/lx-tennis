import { EmptyState } from "@/components/empty-state";
import { RacquetList } from "@/components/racquet-list";
import { SectionTitle } from "@/components/section-title";
import type { BrandSection } from "@/data/racquets";
import styles from "./racquets-by-brand.module.css";

interface RacquetsByBrandProps {
  sections: readonly BrandSection[];
}

/**
 * One section per brand (Product rule 13), in the order `getRacquetsByBrand()`
 * returns them, with an honest empty state for a brand we haven't tested yet.
 * Used on `/racquets`, under its h1: brand names are h2, racquet names h3.
 */
export function RacquetsByBrand({ sections }: RacquetsByBrandProps) {
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
              <RacquetList racquets={racquets} />
            ) : (
              <EmptyState title="No racquets yet" size="compact" />
            )}
          </section>
        );
      })}
    </div>
  );
}
