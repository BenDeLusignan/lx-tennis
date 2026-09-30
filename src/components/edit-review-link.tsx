import type { Setup } from "@/data/setups";
import { Button } from "./button";
import { setupHeadingId } from "./setup-summary";

interface EditReviewLinkProps {
  setup: Setup;
  /** Placement only (e.g. `align-self`), as with Button. */
  className?: string;
}

/**
 * "Edit your review", for a reviewer's own review of a setup. It has no
 * session check of its own: it's only ever passed to AddReviewButton as
 * `whenReviewed`, which shows it to the logged-in reviewer who has reviewed
 * that setup and to nobody else, so it streams in behind the same
 * <Suspense>. Hiding it is only cosmetic: the review page and the
 * updateReview action act only on the session's own review.
 */
export function EditReviewLink({ setup, className }: EditReviewLinkProps) {
  // Named after its setup's heading like "Add your review", since every card has one.
  const linkId = `edit-review-${setup.id}`;
  return (
    <Button
      id={linkId}
      href={`/account/setups/${setup.id}/review`}
      aria-labelledby={`${linkId} ${setupHeadingId(setup.id)}`}
      className={className}
    >
      Edit your review
    </Button>
  );
}
