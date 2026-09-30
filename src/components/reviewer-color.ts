/**
 * Each reviewer's colour token (Ben's call: Ben pink, Michal cyan, Otavio
 * purple), keyed by username because that's stable while display names can
 * change. The tokens themselves, and their contrast, are in globals.css:
 * adding a reviewer's colour means a line here and a token there.
 */
const REVIEWER_COLORS: Readonly<Record<string, string>> = {
  ben: "var(--color-reviewer-ben)",
  michal: "var(--color-reviewer-michal)",
  otavio: "var(--color-reviewer-otavio)",
};

/** A CSS colour value for `--reviewer-color`; a neutral one for anyone without their own. */
export function reviewerColor(username: string): string {
  return REVIEWER_COLORS[username] ?? "var(--color-reviewer-other)";
}
