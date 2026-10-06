import type { CSSProperties } from "react";
import { CRITERIA, type SetupReview } from "@/data/setups";
import { reviewerColor } from "./reviewer-color";
import { ReviewerName } from "./reviewer-name";
import { ScoreChip } from "./score-chip";
import styles from "./score-grid.module.css";

interface ScoreGridProps {
  /**
   * The setup's reviews, which are the columns: one per review, in the
   * order given (by reviewer id, as `Setup.reviews` is). Never empty, since
   * a setup with no reviews is deleted.
   */
  reviews: readonly SetupReview[];
}

/**
 * Product rule 3's grid: criteria as rows, reviewers as columns, so
 * comparing everyone on one criterion means reading across one row. A real
 * table with row and column headers, so a screen reader announces
 * "Power, Michal, 7" for a cell. Only reviewers who reviewed the setup get
 * a column, so there's never an empty slot or a made-up score (rule 9).
 */
export function ScoreGrid({ reviews }: ScoreGridProps) {
  // Three reviewers fit a 360px phone; a fourth or more and the wrapper
  // scrolls sideways (see .grid). It isn't a tab stop, since it normally has
  // nothing to scroll (current browsers make it focusable once it does).
  return (
    <div className={styles.scroller}>
      <table
        className={styles.grid}
        style={{ "--reviewer-count": reviews.length } as CSSProperties}
      >
        <caption className={styles.caption}>Scores out of 10</caption>
        {/* The criterion column is sized to its longest label; the
            reviewer columns split the rest evenly (table-layout: fixed). */}
        <colgroup>
          <col className={styles.criterionColumn} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Criterion</span>
            </th>
            {reviews.map(({ reviewer }) => (
              <th key={reviewer.id} scope="col">
                <ReviewerName reviewer={reviewer} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CRITERIA.map((criterion) => (
            <tr key={criterion.key}>
              <th scope="row">{criterion.label}</th>
              {reviews.map(({ reviewer, scores }) => {
                const style = { "--score-chip-color": reviewerColor(reviewer.username) } as CSSProperties;
                return (
                  <td key={reviewer.id} style={style}>
                    <ScoreChip value={scores[criterion.key]} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
