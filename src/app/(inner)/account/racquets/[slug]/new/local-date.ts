/**
 * Today as YYYY-MM-DD in the reviewer's own time zone, the format a date
 * input's value and `max` take. Shared by SetupFormConstraints (the max)
 * and TodayButton (the value) so the two can't disagree.
 *
 * Why the reviewer's own today is accepted: the server takes any date up to
 * today in the latest time zone on Earth, UTC+14 (src/reviews/setup-form.ts),
 * and no time zone is east of UTC+14, so with a correct device clock this
 * local today is never in the future by the server's rule — even when it's
 * already tomorrow by the server's clock. The client's max may be tighter
 * than the server's, but never refuses what the server would take. A device
 * clock set fast (hours ahead) still lands on a date the server refuses,
 * exactly as if it had been typed wrong.
 */
export function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}