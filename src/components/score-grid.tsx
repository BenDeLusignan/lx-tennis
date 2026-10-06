import { useId, type CSSProperties } from "react";
import { CRITERIA, MAX_TOTAL_SCORE, totalScore, type SetupReview } from "@/data/setups";
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
 *
 * The last row is each reviewer's Total out of 50, derived from their five
 * scores when rendered. It sits in a <tfoot> under a stronger line and is
 * plain bold text, not a chip, so it reads as a sum and not a sixth criterion.
 */
export function ScoreGrid({ reviews }: ScoreGridProps) {
  const captionId = useId();

  // Three reviewers fit a 360px phone; a fourth or more and the wrapper
  // scrolls sideways (see .grid). It isn't a tab stop, since it normally has
  // nothing to scroll (current browsers make it focusable once it does).
  //
  // The visible caption is a paragraph above the table that names it
  // (aria-labelledby), not a <caption>: a <caption> is only as wide as the
  // table, and a lone reviewer's table is capped narrow (see .grid), so the
  // same words wrapped onto two lines on one card and one on the next. The
  // paragraph is as wide as the card, so every card wraps it the same way.
  return (
    <div>
      <p id={captionId} className={styles.caption}>
        Scores out of 10, total out of {MAX_TOTAL_SCORE}
      </p>
      <div className={styles.scroller}>
        <table
          className={styles.grid}
          aria-labelledby={captionId}
          style={{ "--reviewer-count": reviews.length } as CSSProperties}
        >
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
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {reviews.map(({ reviewer, scores }) => {
                const style = { "--total-color": reviewerColor(reviewer.username) } as CSSProperties;
                return (
                  <td key={reviewer.id} style={style}>
                    {/* Heard as "36 out of 50": the visible "/50" is for the eye only. */}
                    <span className={styles.total}>{totalScore(scores)}</span>
                    <span className={styles.outOf} aria-hidden="true">
                      /{MAX_TOTAL_SCORE}
                    </span>
                    <span className="visually-hidden"> out of {MAX_TOTAL_SCORE}</span>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
