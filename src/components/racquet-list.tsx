import { Panel } from "@/components/panel";
import { RacquetPhoto } from "@/components/racquet-photo";
import type { Racquet } from "@/data/racquets";
import styles from "./racquet-list.module.css";

interface RacquetListProps {
  racquets: readonly Racquet[];
  /** Level for each racquet's name: one below the heading this list sits under. */
  headingLevel: "h2" | "h3";
}

/** Grid of racquet cards linking to each racquet's page. Used on `/` and `/racquets`. */
export function RacquetList({ racquets, headingLevel: Name }: RacquetListProps) {
  return (
    <ul className={styles.grid}>
      {racquets.map((racquet) => (
        <li key={racquet.slug}>
          {/* Name the link by its text only; the photo keeps its own alt text. */}
          <Panel
            href={`/racquets/${racquet.slug}`}
            className={styles.card}
            aria-labelledby={`${racquet.slug}-name ${racquet.slug}-meta`}
          >
            <RacquetPhoto
              image={racquet.image}
              sizes="(min-width: 48rem) 20rem, 7rem"
              className={styles.photo}
            />
            <div className={styles.cardText}>
              <Name id={`${racquet.slug}-name`} className={styles.cardName}>
                {racquet.name}
              </Name>
              <span id={`${racquet.slug}-meta`} className={styles.cardMeta}>
                {racquet.generation ? `${racquet.year} · ${racquet.generation}` : racquet.year}
              </span>
              <span className={styles.cardCta} aria-hidden="true">
                View details &rarr;
              </span>
            </div>
          </Panel>
        </li>
      ))}
    </ul>
  );
}
