import styles from "./score-chip.module.css";

interface ScoreChipProps {
  /** A whole number from 1 to 10 (Product rule 5). */
  value: number;
}

/**
 * The one look for a score, wherever a score is shown: the score grid and
 * the scoring buttons on the entry forms (Ben's call). Its colours come
 * from custom properties a parent can set, rather than from props or
 * overriding classes, so the grid can tint a column and a form can fill a
 * chosen score without either restyling the chip:
 *   --score-chip-color  border and glow (default: the pink accent)
 *   --score-chip-fill   background (default: none)
 *   --score-chip-text   text colour (default: --color-text)
 */
export function ScoreChip({ value }: ScoreChipProps) {
  return <span className={styles.chip}>{value}</span>;
}
