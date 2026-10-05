import { Panel } from "@/components/panel";
import { RacquetPhoto } from "@/components/racquet-photo";
import type { Racquet } from "@/data/racquets";
import styles from "./racquet-list.module.css";

interface RacquetListProps {
  racquets: readonly Racquet[];
}

/**
 * Grid of one brand's racquet cards, each linking to its racquet page.
 * `RacquetsByBrand` renders one per brand, under the brand's h2, so each
 * racquet's name is an h3.
 */
export function RacquetList({ racquets }: RacquetListProps) {
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
              {/*
                The brand heading above already names the brand, so the card shows
                just the model, which keeps names on one line on a phone. The
                brand stays in the link's name for screen readers, which can
                list links away from their heading.
              */}
              <h3 id={`${racquet.slug}-name`} className={styles.cardName}>
                <span className="visually-hidden">{racquet.brand} </span>
                {modelName(racquet)}
              </h3>
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

/** "Yonex EZONE 98" → "EZONE 98". A name that doesn't start with its brand is shown whole. */
function modelName({ name, brand }: Racquet) {
  const prefix = `${brand} `;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}
