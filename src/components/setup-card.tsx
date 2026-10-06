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
 * The grid that setup cards sit in: as many ~24rem columns as fit, one on a
 * phone. Use it for every run of `SetupCard`s, since the cards' alignment
 * relies on this being their parent (see setup-card.module.css).
 */
export function SetupCardList({ children }: { children: ReactNode }) {
  return <div className={styles.list}>{children}</div>;
}

/**
 * One setup on a racquet's page or a string's results (Product rule 3): the
 * setup on top, then everyone's scores side by side, then the written reviews.
 * Its id, `setup-<id>`, is where saving a setup or review lands
 * (`/racquets/<slug>#setup-<id>`).
 *
 * The four wrappers (summary, scores, written, actions) are the card's rows;
 * cards sharing a row of the list line them up (setup-card.module.css).
 */
export function SetupCard({ setup, children }: SetupCardProps) {
  const anchor = `setup-${setup.id}`;
  // In the grid's column order (`setup.reviews` is by reviewer id), so the
  // written reviews read in the same order as the scores.
  const written = setup.reviews.flatMap(({ reviewer, body }) => (body ? [{ reviewer, body }] : []));

  return (
    <Panel id={anchor} aria-labelledby={setupHeadingId(setup.id)} className={styles.card}>
      <div className={styles.summary}>
        <SetupSummary setup={setup} headingLevel="h3" />
      </div>

      <div className={styles.scores}>
        <ScoreGrid reviews={setup.reviews} />
      </div>

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

      {/* display: contents (see the CSS), so whatever streams in here is the card's own row-4 item. */}
      <div className={styles.actions}>{children}</div>
    </Panel>
  );
}
