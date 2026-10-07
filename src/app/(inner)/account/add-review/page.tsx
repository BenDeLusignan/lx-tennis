import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { loginPath } from "@/auth/safe-next-path";
import { BackLink } from "@/components/back-link";
import { RacquetsByBrand } from "@/components/racquets-by-brand";
import { SectionTitle } from "@/components/section-title";
import { getRacquetsByBrand } from "@/data/racquets";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Add a review",
  description: "Choose the racquet your setup is for.",
};

const ADD_REVIEW_PATH = "/account/add-review";

// Step one of "Add a Review" on the landing page: choose the racquet, then the
// existing new-setup page takes over. It lives under /account so the proxy and
// the page's own check keep visitors out, like every reviewers-only page.
//
// The racquet list is cached and refreshed when a racquet changes, so it's
// the same list as /racquets; only the login check streams.
export default async function AddReviewPage() {
  const brands = await getRacquetsByBrand();

  return (
    <>
      <Suspense fallback={null}>
        <LoginCheck />
      </Suspense>
      <BackLink href="/">Home</BackLink>
      <SectionTitle as="h1">Add a review</SectionTitle>
      <p className={styles.intro}>Pick the racquet the setup is for.</p>
      <RacquetsByBrand
        sections={brands}
        hrefFor={(racquet) => `/account/racquets/${racquet.slug}/new`}
        cta="Add a review"
      />
    </>
  );
}

// The page's own login check (the proxy's is only the quick one). Renders
// nothing; it only redirects a visitor whose session isn't valid.
async function LoginCheck() {
  const reviewer = await getCurrentReviewer();
  if (!reviewer) redirect(loginPath(ADD_REVIEW_PATH));
  return null;
}
