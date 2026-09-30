import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { loginPath } from "@/auth/safe-next-path";
import { AddReviewButton } from "@/components/add-review-button";
import { BackLink } from "@/components/back-link";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { FormActions } from "@/components/form-actions";
import { FormMessage } from "@/components/form-message";
import { Input } from "@/components/input";
import { Panel } from "@/components/panel";
import { ReviewFields } from "@/components/review-fields";
import { SectionTitle } from "@/components/section-title";
import { SetupSummary } from "@/components/setup-summary";
import { SubmitButton } from "@/components/submit-button";
import { getRacquet, getRacquetSlugs } from "@/data/racquets";
import { getRacquetSetups } from "@/data/setups";
import { getStrings } from "@/data/strings";
import { GAUGE_LIMITS_MM, TENSION_LIMITS } from "@/data/units";
import { createSetupWithReview } from "@/reviews/actions";
import { SetupFormConstraints } from "./setup-form-constraints";
import { StringPicker } from "./string-picker";
import { TensionHint } from "./tension-hint";
import styles from "./page.module.css";

// Prerendered per racquet, like the racquet page, with its list of setups
// and the string list in the static shell (all cached, refreshed on save).
// Only the login check and the `?error=` message stream in. An unknown slug
// renders on request and 404s; `instant = false` for the same reason as on
// the racquet page.
export const instant = false;

export async function generateStaticParams() {
  const slugs = await getRacquetSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/account/racquets/[slug]/new">): Promise<Metadata> {
  const { slug } = await params;
  const racquet = await getRacquet(slug);
  if (!racquet) return {};
  return { title: `Add a setup: ${racquet.name}` };
}

// The codes createSetupWithReview redirects with. Each says what to fix,
// and that the form was emptied: a failed save reloads the page, so
// nothing typed survives it.
const ERRORS: Record<string, string> = {
  invalid: "Something in the form was missing or not in the right format.",
  unit: "Choose lb or kg for the tensions.",
  tension: `Each tension must be ${TENSION_LIMITS.lb.min}–${TENSION_LIMITS.lb.max} lb or ${TENSION_LIMITS.kg.min}–${TENSION_LIMITS.kg.max} kg, with at most one decimal place.`,
  gauge: `Each gauge must be ${GAUGE_LIMITS_MM.min.toFixed(2)}–${GAUGE_LIMITS_MM.max.toFixed(2)} mm, with at most two decimal places.`,
  date: "The date strung must be a real date, and not in the future.",
  scores: "Give all five criteria a whole-number score from 1 to 10.",
  "string-exists":
    "A new string you added is already on the list (ignoring capitals). Choose it from the list instead.",
};

type Props = PageProps<"/account/racquets/[slug]/new">;

export default async function NewSetupPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const racquet = await getRacquet(slug);
  if (!racquet) notFound();
  const [setups, strings] = await Promise.all([getRacquetSetups(slug), getStrings()]);

  return (
    <div className={styles.page}>
      <div>
        <BackLink href={`/racquets/${slug}`}>{racquet.name}</BackLink>
        <SectionTitle as="h1">Add a setup</SectionTitle>
        <p className={styles.lede}>
          For the {racquet.name}: how it was strung, and your review of it.
        </p>
      </div>

      {/* Listed before the form, so nobody enters a setup that's already
          here: adding a review to it keeps everyone's scores side by side
          (Product rule 2). */}
      {setups.length > 0 && (
        <Panel aria-labelledby="existing-heading">
          <SectionTitle id="existing-heading" size="lg">
            Already on this racquet
          </SectionTitle>
          <p className={styles.intro}>If you tested one of these, add your review to it instead.</p>
          <ul className={styles.existing}>
            {setups.map((setup) => (
              <li key={setup.id} className={styles.existingItem}>
                <SetupSummary setup={setup} headingLevel="h3" />
                <AddReviewButton
                  setup={setup}
                  className={styles.existingAction}
                  whenReviewed={<p className={styles.hint}>You&rsquo;ve reviewed this one.</p>}
                />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel aria-labelledby="form-heading">
        <SectionTitle id="form-heading" size="lg">
          New setup and your review
        </SectionTitle>

        <form action={createSetupWithReview} className={styles.form}>
          <input type="hidden" name="racquet" value={slug} />
          <SetupFormConstraints />

          <Suspense fallback={null}>
            <FormStatus slug={slug} searchParams={searchParams} />
          </Suspense>

          <Field label="Date strung" htmlFor="strungOn">
            <Input id="strungOn" name="strungOn" type="date" required />
          </Field>

          <fieldset className={styles.group}>
            <legend className={styles.legend}>Full bed or hybrid</legend>
            <div className={styles.choices}>
              <label className={styles.choice}>
                <input type="radio" name="kind" value="full-bed" defaultChecked />
                Full bed
              </label>
              <label className={styles.choice}>
                <input type="radio" name="kind" value="hybrid" />
                Hybrid
              </label>
            </div>
          </fieldset>

          {/* Nothing pre-selected (Product rule 6): the reviewer must pick. */}
          <fieldset className={styles.group} aria-describedby="unit-hint">
            <legend className={styles.legend}>Tension unit</legend>
            <p id="unit-hint" className={styles.hint}>
              For both the mains and the crosses.
            </p>
            <div className={styles.choices}>
              <label className={styles.choice}>
                <input type="radio" name="tensionUnit" value="lb" required />
                lb
              </label>
              <label className={styles.choice}>
                <input type="radio" name="tensionUnit" value="kg" required />
                kg
              </label>
            </div>
          </fieldset>

          <div className={styles.sides}>
            <fieldset className={`${styles.group} ${styles.side}`}>
              <legend className={styles.legend}>Mains</legend>
              <StringPicker side="mains" strings={strings} alwaysShown />
              <GaugeField side="mains" alwaysShown />
              <TensionField side="mains" />
            </fieldset>

            <fieldset className={`${styles.group} ${styles.side}`}>
              <legend className={styles.legend}>Crosses</legend>
              {/* A full bed's crosses take the mains' string and gauge, so
                  only a hybrid shows them (the CSS reveal in page.module.css). */}
              <p className={`${styles.hint} ${styles.fullBedOnly}`}>
                Same string and gauge as the mains.
              </p>
              <div className={styles.hybridOnly}>
                <StringPicker side="crosses" strings={strings} alwaysShown={false} />
                <GaugeField side="crosses" alwaysShown={false} />
              </div>
              <TensionField side="crosses" />
            </fieldset>
          </div>

          <ReviewFields />

          {/* Cancel is only a link back to the racquet: nothing is saved, and it
              works before JavaScript loads. */}
          <FormActions>
            <SubmitButton pendingLabel="Saving…" fill>
              Save setup
            </SubmitButton>
            <Button href={`/racquets/${slug}`} fill>
              Cancel
            </Button>
          </FormActions>
        </form>
      </Panel>
    </div>
  );
}

function GaugeField({ side, alwaysShown }: { side: "mains" | "crosses"; alwaysShown: boolean }) {
  const id = `${side}Gauge`;
  return (
    <Field label="Gauge (mm)" htmlFor={id}>
      <Input
        id={id}
        name={id}
        type="number"
        inputMode="decimal"
        min={GAUGE_LIMITS_MM.min}
        max={GAUGE_LIMITS_MM.max}
        step={0.01}
        required={alwaysShown}
        data-required-when-shown={alwaysShown ? undefined : ""}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className={styles.hint}>
        As printed on the packet, e.g. 1.25
      </p>
    </Field>
  );
}

// min and max allow either unit's range until JavaScript narrows them to
// the chosen one (SetupFormConstraints); the server checks the exact range.
function TensionField({ side }: { side: "mains" | "crosses" }) {
  const id = `${side}Tension`;
  return (
    <Field label={side === "mains" ? "Mains tension" : "Crosses tension"} htmlFor={id}>
      <Input
        id={id}
        name={id}
        type="number"
        inputMode="decimal"
        min={TENSION_LIMITS.kg.min}
        max={TENSION_LIMITS.lb.max}
        step={0.1}
        required
        data-tension=""
        aria-describedby={`${id}-hint`}
      />
      <TensionHint id={`${id}-hint`} inputId={id} />
    </Field>
  );
}

// The page's own login check (the proxy's is only the quick one), and the
// message for the last failed save.
async function FormStatus({ slug, searchParams }: { slug: string } & Pick<Props, "searchParams">) {
  const reviewer = await getCurrentReviewer();
  if (!reviewer) redirect(loginPath(`/account/racquets/${slug}/new`));

  const { error } = await searchParams;
  // Own keys only, so `?error=constructor` can't find Object's.
  if (typeof error !== "string" || !Object.hasOwn(ERRORS, error)) return null;
  return (
    <FormMessage key={crypto.randomUUID()} tone="error">
      {ERRORS[error]} Nothing was saved, so the form is empty again.
    </FormMessage>
  );
}
