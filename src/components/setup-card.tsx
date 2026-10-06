import type { ReactNode } from "react";
import type { Setup } from "@/data/setups";
import { Panel } from "./panel";
import { ReviewerName } from "./reviewer-name";
import { ScoreGrid } from "./score-grid";
import { SetupSummary, setupHeadingId } from "./setup-summary";
import styles from "./setup-card.module.css";

interface SetupCardProps {
  setup: Setup;
  /** Reviewer-only controls at the foot of the card (streamed in by the page). */
  children?: ReactNode;
}

/**
 * One setup on a racquet's page or a string's results (Product rule 3): the
 * setup on top, then everyone's scores side by side, then the written reviews.
 * Its id, `setup-<id>`, is where saving a setup or review lands
 * (`/racquets/<slug>#setup-<id>`).
 */
export function SetupCard({ setup, children }: SetupCardProps) {
  const anchor = `setup-${setup.id}`;
  // In the grid's column order (`setup.reviews` is by reviewer id), so the
  // written reviews read in the same order as the scores.
  const written = setup.reviews.flatMap(({ reviewer, body }) => (body ? [{ reviewer, body }] : []));

  return (
    <Panel id={anchor} aria-labelledby={setupHeadingId(setup.id)} className={styles.card}>
      <SetupSummary setup={setup} headingLevel="h3" />
      <ScoreGrid reviews={setup.reviews} />

      {written.length > 0 && (
        <div className={styles.written}>
          <h4 className={styles.writtenTitle}>Written reviews</h4>
          <ul className={styles.reviewList}>
            {written.map(({ reviewer, body }) => (
              <li key={reviewer.id} className={styles.review}>
                <ReviewerName reviewer={reviewer} />
                <p className={styles.body}>{body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {children}
    </Panel>
  );
}
