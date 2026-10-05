import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { loginPath } from "@/auth/safe-next-path";
import { BackLink } from "@/components/back-link";
import { Button } from "@/components/button";
import { FormActions } from "@/components/form-actions";
import { FormMessage } from "@/components/form-message";
import { Panel } from "@/components/panel";
import { RACQUET_ERROR_MESSAGES } from "@/components/racquet-error-messages";
import { RacquetFields } from "@/components/racquet-fields";
import { SectionTitle } from "@/components/section-title";
import { SubmitButton } from "@/components/submit-button";
import { addRacquet } from "@/racquets/actions";
import { NEW_RACQUET_PATH, RACQUET_ERROR_FLAGS } from "@/racquets/racquet-form";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Add a racquet",
};

export default function NewRacquetPage({ searchParams }: PageProps<"/account/racquets/new">) {
  return (
    <div className={styles.page}>
      <div>
        <BackLink href="/racquets">All racquets</BackLink>
        <SectionTitle as="h1">Add a racquet</SectionTitle>
        <p className={styles.lede}>
          Add a racquet that&rsquo;s missing from the list, so setups and reviews can be entered for
          it. The photo is required.
        </p>
      </div>

      <Panel aria-labelledby="form-heading">
        <SectionTitle id="form-heading" size="lg">
          Racquet details
        </SectionTitle>

        {/* React gives a form with a Server Action method="post" and enctype="multipart/form-data"
            itself (setting them here only logs a warning). Multipart is what carries the photo,
            and as a plain POST it works before JavaScript loads, like the other forms. The fields
            are shared with the edit form (RacquetFields). */}
        <form action={addRacquet} className={styles.form}>
          <Suspense fallback={null}>
            <FormStatus searchParams={searchParams} />
          </Suspense>

          <RacquetFields />

          {/* Cancel is only a link back to the list: nothing is saved, and it
              works before JavaScript loads. */}
          <FormActions>
            <SubmitButton pendingLabel="Adding…" fill>
              Add racquet
            </SubmitButton>
            <Button href="/racquets" fill>
              Cancel
            </Button>
          </FormActions>
        </form>
      </Panel>
    </div>
  );
}

// The page's own login check (the proxy's is only the quick one), and the
// message for the last refused save.
async function FormStatus({ searchParams }: Pick<PageProps<"/account/racquets/new">, "searchParams">) {
  const reviewer = await getCurrentReviewer();
  if (!reviewer) redirect(loginPath(NEW_RACQUET_PATH));

  const { error } = await searchParams;
  // Only the flags the action can send, so `?error=constructor` finds nothing.
  const flag = RACQUET_ERROR_FLAGS.find((known) => known === error);
  if (!flag) return null;
  return (
    <FormMessage key={crypto.randomUUID()} tone="error">
      {RACQUET_ERROR_MESSAGES[flag]} Nothing was saved, so the form is empty again and the photo (or
      its link) needs adding again.
    </FormMessage>
  );
}
