import { REVIEW_BODY_MAX_LENGTH } from "@/data/limits";
import { CRITERIA } from "@/data/setups";
import { Field } from "./field";
import { TextArea } from "./input";
import { ScoreChip } from "./score-chip";
import styles from "./review-fields.module.css";

const SCORES = Array.from({ length: 10 }, (_, index) => index + 1);

/**
 * The review half of both entry forms (a new setup with your review, and
 * your review of an existing setup): the five scores, then the optional
 * written review. Field names (`power`…`feel`, `body`) are the ones the
 * reviews actions read.
 *
 * Each score is a group of ten radio buttons drawn as score chips, rather
 * than a number field: one tap each, no keyboard to open at the court, and
 * no way to type 7.5 or 11 (Product rule 5). `required` on a radio group
 * makes the browser refuse to submit until every criterion has a score
 * (rule 4), before JavaScript loads too.
 */
export function ReviewFields() {
  return (
    <>
      <fieldset className={styles.scores} aria-describedby="scores-hint">
        <legend className={styles.legend}>Your scores</legend>
        <p id="scores-hint" className={styles.hint}>
          All five, from 1 (lowest) to 10 (highest).
        </p>
        {CRITERIA.map((criterion) => (
          <fieldset key={criterion.key} className={styles.criterion}>
            <legend className={styles.criterionLegend}>{criterion.label}</legend>
            <div className={styles.choices}>
              {SCORES.map((score) => (
                <label key={score} className={styles.choice}>
                  <input
                    type="radio"
                    name={criterion.key}
                    value={score}
                    required
                    className={styles.radio}
                  />
                  <ScoreChip value={score} />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </fieldset>

      <Field
        label={
          <>
            Written review <span className={styles.optional}>(optional)</span>
          </>
        }
        htmlFor="body"
      >
        <TextArea id="body" name="body" rows={6} maxLength={REVIEW_BODY_MAX_LENGTH} />
      </Field>
    </>
  );
}
