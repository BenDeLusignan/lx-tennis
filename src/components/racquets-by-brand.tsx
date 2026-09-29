import { EmptyState } from "@/components/empty-state";
import { RacquetList } from "@/components/racquet-list";
import { SectionTitle } from "@/components/section-title";
import type { BrandSection } from "@/data/racquets";
import styles from "./racquets-by-brand.module.css";

interface RacquetsByBrandProps {
  sections: readonly BrandSection[];
  /**
   * Level for each brand's name: one below the heading this sits under.
   * Racquet names go one level below that.
   */
  headingLevel: "h2" | "h3";
}

const racquetNameLevel = { h2: "h3", h3: "h4" } as const;

/**
 * One section per brand (Product rule 13), in the order `getRacquetsByBrand()`
 * returns them, with an honest empty state for a brand we haven't tested yet.
 * Used on `/` and `/racquets`.
 */
export function RacquetsByBrand({ sections, headingLevel }: RacquetsByBrandProps) {
  return (
    <div className={styles.brands}>
      {sections.map(({ brand, racquets }) => {
        const headingId = `brand-${brand.toLowerCase().replace(/\s+/g, "-")}`;
        return (
          <section key={brand} aria-labelledby={headingId}>
            <SectionTitle as={headingLevel} id={headingId} size="lg">
              {brand}
            </SectionTitle>
            {racquets.length > 0 ? (
              <RacquetList racquets={racquets} headingLevel={racquetNameLevel[headingLevel]} />
            ) : (
              <EmptyState title="No racquets yet" size="compact" />
            )}
          </section>
        );
      })}
    </div>
  );
}
