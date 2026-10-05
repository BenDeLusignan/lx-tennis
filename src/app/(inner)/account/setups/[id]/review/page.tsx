import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { loginPath } from "@/auth/safe-next-path";
import { BackLink } from "@/components/back-link";
import { Button } from "@/components/button";
import { ConfirmDelete } from "@/components/confirm-delete";
import { FormActions } from "@/components/form-actions";
import { FormMessage } from "@/components/form-message";
import { Panel } from "@/components/panel";
import { ReviewFields } from "@/components/review-fields";
import { SectionTitle } from "@/components/section-title";
import { SetupSummary } from "@/components/setup-summary";
import { SubmitButton } from "@/components/submit-button";
import { getRacquet } from "@/data/racquets";
import { getSetup, type Setup } from "@/data/setups";
import { parseId } from "@/forms/fields";
import { addReview, deleteReview, updateReview } from "@/reviews/actions";
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
        <YourReview setup={setup} searchParams={searchParams} />
        <DeleteYourReview setup={setup} />
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
  // Where Cancel and a finished edit both go: the setup's card. A plain link,
  // so leaving the form saves nothing and works before JavaScript loads.
  const cardHref = `/racquets/${setup.racquetSlug}#setup-${setup.id}`;
  // A fresh key per response, so the same message twice is focused again.
  const key = crypto.randomUUID();
  const errorMessage = typeof error === "string" && Object.hasOwn(ERRORS, error) ? ERRORS[error] : null;

  if (mine) {
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
          <FormActions>
            <SubmitButton pendingLabel="Saving…" fill>
              Save changes
            </SubmitButton>
            <Button href={cardHref} fill>
              Cancel
            </Button>
          </FormActions>
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
        <FormActions>
          <SubmitButton pendingLabel="Saving…" fill>
            Save review
          </SubmitButton>
          <Button href={cardHref} fill>
            Cancel
          </Button>
        </FormActions>
      </form>
    </Panel>
  );
}

// Only for a reviewer who has reviewed the setup (the server only ever
// deletes the session reviewer's own review, in `deleteReview`; this is just
// what the page offers). Step one is a <details>, so the confirmation works
// before JavaScript loads: opening it reveals what deleting does and the
// real Delete button, a Server Action POST. Whether others have reviewed is
// read per request, so the warning says whether the setup goes too.
async function DeleteYourReview({ setup }: { setup: Setup }) {
  const reviewer = await getCurrentReviewer();
  // YourReview sends visitors to log in; a reviewer with no review sees nothing.
  if (!reviewer || !setup.reviews.some((review) => review.reviewer.id === reviewer.id)) return null;

  const othersReviewed = setup.reviews.some((review) => review.reviewer.id !== reviewer.id);

  return (
    <Panel aria-labelledby="delete-heading">
      <SectionTitle id="delete-heading" size="lg">
        Delete your review
      </SectionTitle>
      <div className={styles.delete}>
        <p className={styles.note}>Entered under the wrong racquet? You can delete your review.</p>
        <ConfirmDelete
          summary="Delete your review…"
          action={deleteReview}
          confirmLabel="Yes, delete my review"
          warning={
            <>
              This deletes your review. It can&rsquo;t be undone.{" "}
              {othersReviewed
                ? "Other reviewers’ reviews stay."
                : "Yours is the only review, so the setup is deleted too."}
            </>
          }
        >
          <input type="hidden" name="setup" value={setup.id} />
        </ConfirmDelete>
      </div>
    </Panel>
  );
}
