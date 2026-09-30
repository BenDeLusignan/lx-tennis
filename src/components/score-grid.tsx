import type { CSSProperties } from "react";
import type { Reviewer } from "@/data/reviewers";
import { CRITERIA, type SetupReview } from "@/data/setups";
import { reviewerColor } from "./reviewer-color";
import { ReviewerName } from "./reviewer-name";
import { ScoreChip } from "./score-chip";
import styles from "./score-grid.module.css";

interface ScoreGridProps {
  /** Every reviewer, in column order: one column each, reviewed or not. */
  reviewers: readonly Reviewer[];
  reviews: readonly SetupReview[];
}

/**
 * Product rule 3's grid: criteria as rows, reviewers as columns, so
 * comparing everyone on one criterion means reading across one row. A real
 * table with row and column headers, so a screen reader announces
 * "Power, Michal, 7" for a cell. A reviewer who hasn't reviewed the setup
 * keeps their column, with empty slots rather than any made-up score
 * (rule 9).
 */
export function ScoreGrid({ reviewers, reviews }: ScoreGridProps) {
  const reviewsByReviewer = new Map(reviews.map((review) => [review.reviewer.id, review]));

  // Three reviewers fit a 360px phone; a fourth or more and the wrapper
  // scrolls sideways (see .grid). It isn't a tab stop, since it normally has
  // nothing to scroll (current browsers make it focusable once it does).
  return (
    <div className={styles.scroller}>
      <table
        className={styles.grid}
        style={{ "--reviewer-count": reviewers.length } as CSSProperties}
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
            {reviewers.map((reviewer) => (
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
              {reviewers.map((reviewer) => {
                const review = reviewsByReviewer.get(reviewer.id);
                const style = { "--score-chip-color": reviewerColor(reviewer.username) } as CSSProperties;
                return (
                  <td key={reviewer.id} style={style}>
                    {review ? (
                      <ScoreChip value={review.scores[criterion.key]} />
                    ) : (
                      <span className={styles.empty}>
                        <span className="visually-hidden">Not reviewed</span>
                      </span>
                    )}
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
