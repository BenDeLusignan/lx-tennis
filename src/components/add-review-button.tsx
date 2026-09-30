import { Suspense, type ReactNode } from "react";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import type { Setup } from "@/data/setups";
import { Button } from "./button";
import { setupHeadingId } from "./setup-summary";

interface AddReviewButtonProps {
  setup: Setup;
  /**
   * Shown instead when the logged-in reviewer has already reviewed it. The
   * caller decides what's useful there (the racquet page: "Edit your review";
   * the new-setup page: "You've reviewed this one"). Nothing by default.
   */
  whenReviewed?: ReactNode;
  /** Placement only (e.g. `align-self`), as with Button. */
  className?: string;
}

/**
 * "Add your review" for the logged-in reviewer, on a setup they haven't
 * reviewed yet; nothing for visitors. Like AuthStatus, it reads the session
 * cookie, so it streams in behind its own <Suspense> and the setup around it
 * stays in the static shell. Hiding it is only cosmetic: the page it links
 * to and the addReview action both check for themselves.
 */
export function AddReviewButton(props: AddReviewButtonProps) {
  return (
    <Suspense fallback={null}>
      <AddReviewButtonContent {...props} />
    </Suspense>
  );
}

async function AddReviewButtonContent({ setup, whenReviewed = null, className }: AddReviewButtonProps) {
  const reviewer = await getCurrentReviewer();
  if (!reviewer) return null;
  if (setup.reviews.some((review) => review.reviewer.id === reviewer.id)) return whenReviewed;

  // Several setups on a page each get an "Add your review" link, so each is
  // named after its setup's heading too (in a links list: "Add your review
  // Yonex POLYTOUR PRO"). Its own id comes first so the visible text stays
  // the start of the name.
  const linkId = `add-review-${setup.id}`;
  return (
    <Button
      id={linkId}
      href={`/account/setups/${setup.id}/review`}
      aria-labelledby={`${linkId} ${setupHeadingId(setup.id)}`}
      className={className}
    >
      Add your review
    </Button>
  );
}
