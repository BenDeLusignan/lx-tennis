import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { loginPath } from "@/auth/safe-next-path";
import { BackLink } from "@/components/back-link";
import { Button } from "@/components/button";
import { FormMessage } from "@/components/form-message";
import { Panel } from "@/components/panel";
import { ReviewFields } from "@/components/review-fields";
import { SectionTitle } from "@/components/section-title";
import { SetupSummary } from "@/components/setup-summary";
import { SubmitButton } from "@/components/submit-button";
import { getRacquet } from "@/data/racquets";
import { getSetup, type Setup } from "@/data/setups";
import { parseId } from "@/forms/fields";
import { addReview } from "@/reviews/actions";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Add your review",
};

// Setups are added all the time, so there's no list of ids to prerender.
// The page looks its setup up before anything is sent, which is what lets
// an unknown id get a real 404 rather than a "not found" inside a 200; the
// lookup is one quick query, and `instant = false` allows the page to wait
// for it. Only the login check, and what depends on who's logged in, stream
// in behind <Suspense>.
export const instant = false;

type Props = PageProps<"/account/setups/[id]/review">;

// The codes addReview redirects with.
const ERRORS: Record<string, string> = {
  invalid: "Something in the form was missing or not in the right format.",
  scores: "Give all five criteria a whole-number score from 1 to 10.",
};

export default async function AddReviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const setupId = parseId(id);
  const setup = setupId === null ? undefined : await getSetup(setupId);
  const racquet = setup && (await getRacquet(setup.racquetSlug));
  if (!setup || !racquet) notFound();

  // Other reviewers' scores aren't shown here, only on the racquet page:
  // seeing them first would pull your own scores towards theirs.
  return (
    <div className={styles.page}>
      <div>
        <BackLink href={`/racquets/${racquet.slug}`}>{racquet.name}</BackLink>
        <SectionTitle as="h1">Add your review</SectionTitle>
      </div>

      <Panel aria-labelledby="setup-heading">
        <p className={styles.eyebrow}>{racquet.name}</p>
        <SetupSummary setup={setup} headingLevel="h2" headingId="setup-heading" />
      </Panel>

      <Suspense fallback={null}>
        <YourReview setup={setup} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// The form, or "you've reviewed this" (Product rule 2: one review per
// person per setup), after the page's own login check (the proxy's is only
// the quick one).
async function YourReview({ setup, searchParams }: { setup: Setup } & Pick<Props, "searchParams">) {
  const reviewer = await getCurrentReviewer();
  if (!reviewer) redirect(loginPath(`/account/setups/${setup.id}/review`));

  const { existing, error } = await searchParams;
  const cardHref = `/racquets/${setup.racquetSlug}#setup-${setup.id}`;

  if (setup.reviews.some((review) => review.reviewer.id === reviewer.id)) {
    return (
      <>
        {existing === "1" && (
          // Sent here by createSetupWithReview instead of saving a duplicate,
          // and this reviewer's own review is already on it.
          <FormMessage key={crypto.randomUUID()} tone="error">
            This setup is already on the site, so nothing from the new-setup form was saved.
          </FormMessage>
        )}
        <Panel aria-labelledby="reviewed-heading" className={styles.reviewed}>
          <SectionTitle id="reviewed-heading" size="lg">
            You&rsquo;ve reviewed this setup
          </SectionTitle>
          <p>There&rsquo;s one review per person per setup, and yours is already on it.</p>
          <Button href={cardHref} className={styles.reviewedAction}>
            See it on the racquet page
          </Button>
        </Panel>
      </>
    );
  }

  // A fresh key per response, so the same message twice is focused again.
  const key = crypto.randomUUID();
  return (
    <Panel aria-labelledby="form-heading">
      <SectionTitle id="form-heading" size="lg">
        Your review
      </SectionTitle>
      <form action={addReview} className={styles.form}>
        <input type="hidden" name="setup" value={setup.id} />
        {existing === "1" && (
          // Sent here by createSetupWithReview instead of saving a duplicate.
          <FormMessage key={key} tone="error">
            This setup is already on the site; add your review to it. Nothing from the new-setup
            form was saved, so enter your scores here.
          </FormMessage>
        )}
        {typeof error === "string" && Object.hasOwn(ERRORS, error) && (
          <FormMessage key={key} tone="error">
            {ERRORS[error]} Nothing was saved, so the form is empty again.
          </FormMessage>
        )}
        <ReviewFields />
        <SubmitButton pendingLabel="Saving…">Save review</SubmitButton>
      </form>
    </Panel>
  );
}
