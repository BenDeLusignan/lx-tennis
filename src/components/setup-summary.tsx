import type { Setup, SetupSide } from "@/data/setups";
import { formatGauge, formatTension } from "@/data/units";
import styles from "./setup-summary.module.css";

interface SetupSummaryProps {
  setup: Setup;
  /** Pick the level that keeps the page's headings in order. */
  headingLevel: "h2" | "h3";
  /**
   * For the surrounding section's `aria-labelledby`. Defaults to
   * `setupHeadingId(setup.id)`, which `AddReviewButton` also points at.
   */
  headingId?: string;
}

/** The heading's id, so a link near a setup can be named after it (`AddReviewButton`). */
export function setupHeadingId(setupId: number): string {
  return `setup-${setupId}-heading`;
}

// Stored as YYYY-MM-DD with no time zone, so it's formatted in UTC: in any
// other zone, midnight could fall on the day before.
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * The top of a setup card (Product rule 3): the string(s) as its heading,
 * full bed or hybrid, date strung, then gauge(s) and tensions. Also used on
 * its own where a setup is shown without its scores: above the review form.
 */
export function SetupSummary({
  setup,
  headingLevel: Heading,
  headingId = setupHeadingId(setup.id),
}: SetupSummaryProps) {
  const { mains, crosses, fullBed } = setup;
  // Mains first, then crosses: the order players write a hybrid in.
  const title = fullBed ? stringName(mains) : `${stringName(mains)} / ${stringName(crosses)}`;

  return (
    <div className={styles.summary}>
      <Heading id={headingId} className={styles.title}>
        {title}
      </Heading>
      <p className={styles.meta}>
        {fullBed ? "Full bed" : "Hybrid"} · Strung{" "}
        <time dateTime={setup.strungOn}>
          {dateFormat.format(new Date(`${setup.strungOn}T00:00:00Z`))}
        </time>
      </p>

      {/* A full bed has one string and gauge, so they get one row and the
          tensions stand alone; a hybrid needs each side's string beside
          its gauge and tension, so each row carries all three. */}
      <dl className={styles.details}>
        {fullBed ? (
          <>
            <dt>Gauge</dt>
            <dd>{formatGauge(mains.gaugeMm)}</dd>
            <dt>Mains</dt>
            <dd>
              <Tension setup={setup} side={mains} />
            </dd>
            <dt>Crosses</dt>
            <dd>
              <Tension setup={setup} side={crosses} />
            </dd>
          </>
        ) : (
          <>
            <dt>Mains</dt>
            <dd>
              <HybridSide setup={setup} side={mains} />
            </dd>
            <dt>Crosses</dt>
            <dd>
              <HybridSide setup={setup} side={crosses} />
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}

function stringName(side: SetupSide) {
  return `${side.string.brand} ${side.string.name}`;
}

function HybridSide({ setup, side }: { setup: Setup; side: SetupSide }) {
  return (
    <>
      <span className={styles.line}>{stringName(side)}</span>
      <span className={styles.line}>
        {formatGauge(side.gaugeMm)} · <Tension setup={setup} side={side} />
      </span>
    </>
  );
}

/** "55 lb · 24.9 kg": the unit the reviewer typed first, the other one quieter. */
function Tension({ setup, side }: { setup: Setup; side: SetupSide }) {
  const { typed, other } = formatTension(side.tension, setup.tensionUnit);
  return (
    <span>
      {typed} <span className={styles.other}>· {other}</span>
    </span>
  );
}
