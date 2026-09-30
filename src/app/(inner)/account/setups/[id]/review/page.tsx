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
import { addReview, deleteSetup, updateReview } from "@/reviews/actions";
import styles from "./page.module.css";

// The h1 and title are neutral on purpose: add vs edit depends on the
// session, which is read behind <Suspense> (the static shell can't know it).
export const metadata: Metadata = {
  title: "Review this setup",
};

// Setups are added all the time, so there's no list of ids to prerender.
// The page looks its setup up before anything is sent, which is what lets
// an unknown id get a real 404 rather than a "not found" inside a 200; the
// lookup is one quick query, and `instant = false` allows the page to wait
// for it. Only the login check, and what depends on who's logged in, stream
// in behind <Suspense>.
export const instant = false;

type Props = PageProps<"/account/setups/[id]/review">;

// The codes addReview and updateReview redirect with.
const ERRORS: Record<string, string> = {
  invalid: "Something in the form was missing or not in the right format.",
  scores: "Give all five criteria a whole-number score from 1 to 10.",
};

// The codes deleteSetup redirects with.
const DELETE_ERRORS: Record<string, string> = {
  "has-other-reviews": "Someone else has reviewed this setup, so it stays.",
  "not-creator": "Only the reviewer who entered this setup can delete it.",
};

export default async function ReviewPage({ params, searchParams }: Props) {
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
        <SectionTitle as="h1">Review this setup</SectionTitle>
      </div>

      <Panel aria-labelledby="setup-heading">
        <p className={styles.eyebrow}>{racquet.name}</p>
        <SetupSummary setup={setup} headingLevel="h2" headingId="setup-heading" />
      </Panel>

      <Suspense fallback={null}>
        <DeleteRefusal searchParams={searchParams} />
        <YourReview setup={setup} searchParams={searchParams} />
        <DeleteSetup setup={setup} />
      </Suspense>
    </div>
  );
}

// Your review: the add form, or (Product rule 2: one review per person per
// setup) the same form filled in with your review to edit it. After the
// page's own login check (the proxy's is only the quick one).
async function YourReview({ setup, searchParams }: { setup: Setup } & Pick<Props, "searchParams">) {
  const reviewer = await getCurrentReviewer();
  if (!reviewer) redirect(loginPath(`/account/setups/${setup.id}/review`));

  const { existing, error } = await searchParams;
  // The session's own review: nobody's scores but yours ever fill this form.
  const mine = setup.reviews.find((review) => review.reviewer.id === reviewer.id);
  // A fresh key per response, so the same message twice is focused again.
  const key = crypto.randomUUID();
  const errorMessage = typeof error === "string" && Object.hasOwn(ERRORS, error) ? ERRORS[error] : null;

  if (mine) {
    const cardHref = `/racquets/${setup.racquetSlug}#setup-${setup.id}`;
    return (
      <Panel aria-labelledby="form-heading">
        <SectionTitle id="form-heading" size="lg">
          Edit your review
        </SectionTitle>
        <form action={updateReview} className={styles.form}>
          <input type="hidden" name="setup" value={setup.id} />
          {existing === "1" && (
            // Sent here by createSetupWithReview instead of saving a duplicate,
            // and this reviewer's own review is already on it.
            <FormMessage key={key} tone="error">
              This setup is already on the site, so nothing from the new-setup form was saved. Your
              review of it is below.
            </FormMessage>
          )}
          {errorMessage && (
            <FormMessage key={key} tone="error">
              {errorMessage} Nothing was saved, so your review below is as it was. Make your changes
              again.
            </FormMessage>
          )}
          <ReviewFields defaults={{ scores: mine.scores, body: mine.body }} />
          <div className={styles.actions}>
            <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
            <Button href={cardHref}>Back to the setup</Button>
          </div>
        </form>
      </Panel>
    );
  }

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
        {errorMessage && (
          <FormMessage key={key} tone="error">
            {errorMessage} Nothing was saved, so the form is empty again.
          </FormMessage>
        )}
        <ReviewFields />
        <SubmitButton pendingLabel="Saving…">Save review</SubmitButton>
      </form>
    </Panel>
  );
}

// Why a delete was refused, at the top with the other messages so it's seen
// without scrolling, and so it shows before JavaScript loads. Shown to anyone
// the flag reaches, including a forged request from a reviewer who isn't the
// creator (who gets no delete panel).
async function DeleteRefusal({ searchParams }: Pick<Props, "searchParams">) {
  const { error } = await searchParams;
  if (typeof error !== "string" || !Object.hasOwn(DELETE_ERRORS, error)) return null;
  // A fresh key per response, so the same message twice is focused again.
  return (
    <FormMessage key={crypto.randomUUID()} tone="error">
      {DELETE_ERRORS[error]} Nothing was deleted.
    </FormMessage>
  );
}

// Only for the reviewer who entered the setup, and only while nobody else
// has reviewed it (the server checks both in `deleteSetup`; this is just what
// the page offers). Step one is a <details>, so the confirmation works
// before JavaScript loads: opening it reveals what deleting does and the
// real Delete button, a Server Action POST.
async function DeleteSetup({ setup }: { setup: Setup }) {
  const reviewer = await getCurrentReviewer();
  // YourReview sends visitors to log in; anyone else sees nothing.
  if (!reviewer || setup.createdBy !== reviewer.id) return null;

  const othersReviewed = setup.reviews.some((review) => review.reviewer.id !== reviewer.id);

  return (
    <Panel aria-labelledby="delete-heading">
      <SectionTitle id="delete-heading" size="lg">
        Delete this setup
      </SectionTitle>
      <div className={styles.delete}>
        {othersReviewed ? (
          <div className={styles.actions}>
            <Button type="button" disabled aria-describedby="delete-unavailable">
              Delete this setup
            </Button>
            <p id="delete-unavailable" className={styles.note}>
              Others have reviewed this setup, so it can&rsquo;t be deleted.
            </p>
          </div>
        ) : (
          <>
            <p className={styles.note}>
              Entered under the wrong racquet? You can delete the setup while nobody else has
              reviewed it.
            </p>
            <details className={styles.confirm}>
              <summary className={styles.confirmSummary}>Delete this setup…</summary>
              <form action={deleteSetup} className={styles.confirmForm}>
                <input type="hidden" name="setup" value={setup.id} />
                <p className={styles.warning}>
                  This deletes the setup and your review. It can&rsquo;t be undone.
                </p>
                <div className={styles.actions}>
                  <Button type="submit">Yes, delete this setup</Button>
                </div>
              </form>
            </details>
          </>
        )}
      </div>
    </Panel>
  );
}
