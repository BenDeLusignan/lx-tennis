import type { CSSProperties } from "react";
import type { Reviewer } from "@/data/reviewers";
import { reviewerColor } from "./reviewer-color";
import styles from "./reviewer-name.module.css";

/**
 * A reviewer's name in their colour, with a small colour bar in front. The
 * colour is never shown without the name (Ben's call), so this is the one
 * place both appear: the score grid's column headers and the written reviews.
 */
export function ReviewerName({ reviewer }: { reviewer: Reviewer }) {
  const style = { "--reviewer-color": reviewerColor(reviewer.username) } as CSSProperties;
  return (
    <span className={styles.name} style={style}>
      {reviewer.displayName}
    </span>
  );
}
