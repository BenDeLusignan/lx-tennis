import "server-only";
import { loginPath } from "@/auth/safe-next-path";
import type { Reviewer } from "@/data/reviewers";
import { addReview, createSetupWithReview, deleteSetup, updateReview } from "@/data/setups";
import { parseId } from "@/forms/fields";
import { parseRacquetSlug, parseReviewFields, parseSetupForm } from "@/reviews/setup-form";

/**
 * What the review Server Actions (`src/reviews/actions.ts`) do, given the
 * logged-in reviewer (null for a visitor). Each returns the URL the action
 * redirects to; keeping the redirect in the action lets these be tested
 * without a Next request. Error codes go in the URL, never what was typed.
 */

export async function submitSetupWithReview(
  reviewer: Reviewer | null,
  formData: FormData,
): Promise<string> {
  const slug = parseRacquetSlug(formData.get("racquet"));
  // Back to the form after logging in, if the form said which racquet it was.
  if (!reviewer) return loginPath(slug ? `/account/racquets/${slug}/new` : "/account");
  if (!slug) return "/racquets";
  const formPath = `/account/racquets/${slug}/new`;

  const parsed = parseSetupForm(formData, slug);
  if (!parsed.ok) return `${formPath}?error=${parsed.error}`;

  const result = await createSetupWithReview(parsed.value, reviewer);
  switch (result.status) {
    case "created":
      return `/racquets/${slug}#setup-${result.setupId}`;
    case "duplicate":
      return `/account/setups/${result.setupId}/review?existing=1`;
    case "unknown-racquet":
      return "/racquets";
    case "string-exists":
      return `${formPath}?error=string-exists`;
    case "unknown-string":
    case "conflicting-new-strings":
      return `${formPath}?error=invalid`;
  }
}

export async function submitReview(reviewer: Reviewer | null, formData: FormData): Promise<string> {
  const setupId = parseId(formData.get("setup"));
  if (!reviewer) return loginPath(setupId ? `/account/setups/${setupId}/review` : "/account");
  if (!setupId) return "/racquets";
  const reviewPath = `/account/setups/${setupId}/review`;

  const parsed = parseReviewFields(formData);
  if (!parsed.ok) return `${reviewPath}?error=${parsed.error}`;

  const result = await addReview(setupId, parsed.value, reviewer);
  switch (result.status) {
    case "created":
      return `/racquets/${result.racquetSlug}#setup-${setupId}`;
    case "already-reviewed":
      // The page shows that they've reviewed it, with no form.
      return reviewPath;
    case "unknown-setup":
      return `${reviewPath}?error=invalid`;
  }
}

/**
 * Edits the logged-in reviewer's own review of a setup. The form carries only
 * the setup id: whose review changes comes from the session, inside
 * `updateReview`, so nobody can edit another reviewer's review by any request.
 */
export async function submitReviewEdit(
  reviewer: Reviewer | null,
  formData: FormData,
): Promise<string> {
  const setupId = parseId(formData.get("setup"));
  if (!reviewer) return loginPath(setupId ? `/account/setups/${setupId}/review` : "/account");
  if (!setupId) return "/racquets";
  const reviewPath = `/account/setups/${setupId}/review`;

  const parsed = parseReviewFields(formData);
  if (!parsed.ok) return `${reviewPath}?error=${parsed.error}`;

  const result = await updateReview(setupId, parsed.value, reviewer);
  switch (result.status) {
    case "updated":
      return `/racquets/${result.racquetSlug}#setup-${setupId}`;
    case "not-reviewed":
      // Nothing to edit: the page shows the add form instead.
      return reviewPath;
    case "unknown-setup":
      return `${reviewPath}?error=invalid`;
  }
}

/**
 * Deletes a setup its logged-in creator entered by mistake, while nobody
 * else has reviewed it. The form carries only the setup id: who the creator
 * is comes from the session, inside `deleteSetup`, so no field can delete
 * someone else's setup. A setup that's already gone counts as deleted.
 */
export async function submitDeleteSetup(
  reviewer: Reviewer | null,
  formData: FormData,
): Promise<string> {
  const setupId = parseId(formData.get("setup"));
  if (!reviewer) return loginPath(setupId ? `/account/setups/${setupId}/review` : "/account");
  if (!setupId) return "/racquets";
  const reviewPath = `/account/setups/${setupId}/review`;

  const result = await deleteSetup(setupId, reviewer);
  switch (result.status) {
    case "deleted":
      return `/racquets/${result.racquetSlug}`;
    case "unknown-setup":
      // Already deleted (a double submit, say): there's nothing left to show.
      return "/racquets";
    case "not-creator":
    case "has-other-reviews":
      return `${reviewPath}?error=${result.status}`;
  }
}
