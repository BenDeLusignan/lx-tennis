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
import { RACQUET_ERROR_MESSAGES } from "@/components/racquet-error-messages";
import { RacquetFields } from "@/components/racquet-fields";
import { SectionTitle } from "@/components/section-title";
import { SubmitButton } from "@/components/submit-button";
import { getRacquetSlugs, getRacquetsByBrandWithUsage, type RacquetWithUsage } from "@/data/racquets";
import { deleteRacquet, updateRacquet } from "@/racquets/actions";
import {
  editRacquetPath,
  RACQUET_ERROR_FLAGS,
  RACQUET_FIELDS,
  RACQUETS_ADMIN_PATH,
} from "@/racquets/racquet-form";
import styles from "./page.module.css";

// Prerendered per racquet, with its details in the static shell (cached,
// refreshed on save and delete). Only the login check and the `?error=`
// message stream in. An unknown slug, including a racquet that has just been
// deleted, renders on request and 404s; `instant = false` for the same
// reason as on the racquet page.
export const instant = false;

export async function generateStaticParams() {
  const slugs = await getRacquetSlugs();
  return slugs.map((slug) => ({ slug }));
}

type Props = PageProps<"/account/racquets/[slug]/edit">;

async function findRacquet(slug: string): Promise<RacquetWithUsage | undefined> {
  const sections = await getRacquetsByBrandWithUsage();
  return sections.flatMap((section) => section.racquets).find((racquet) => racquet.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const racquet = await findRacquet(slug);
  if (!racquet) return {};
  return { title: `Edit racquet: ${racquet.name}` };
}

export default async function EditRacquetPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const racquet = await findRacquet(slug);
  if (!racquet) notFound();

  return (
    <div className={styles.page}>
      <div>
        <BackLink href={RACQUETS_ADMIN_PATH}>Racquets</BackLink>
        <SectionTitle as="h1">Edit racquet</SectionTitle>
        <p className={styles.lede}>
          {racquet.name} ({racquet.year}). Its page address stays{" "}
          <span className={styles.address}>/racquets/{racquet.slug}</span> whatever you change, so
          links to it keep working.
        </p>
      </div>

      <Panel aria-labelledby="form-heading">
        <SectionTitle id="form-heading" size="lg">
          Racquet details
        </SectionTitle>

        {/* A plain multipart POST (React sets that up for a Server Action), so it
            works before JavaScript loads. The hidden slug says which racquet; the
            server looks it up and never takes anything else about it from the
            request. The fields are shared with the add form (RacquetFields). */}
        <form action={updateRacquet} className={styles.form}>
          <input type="hidden" name={RACQUET_FIELDS.slug} value={racquet.slug} />

          <Suspense fallback={null}>
            <FormStatus slug={racquet.slug} searchParams={searchParams} />
          </Suspense>

          <RacquetFields racquet={racquet} />

          {/* Cancel is only a link back to the list: nothing is saved, and it
              works before JavaScript loads. */}
          <FormActions>
            <SubmitButton pendingLabel="Saving…" fill>
              Save changes
            </SubmitButton>
            <Button href={RACQUETS_ADMIN_PATH} fill>
              Cancel
            </Button>
          </FormActions>
        </form>
      </Panel>

      {/* Its own panel, apart from the edit form: a delete is not a save, and
          the form above must never be able to submit it by accident. */}
      <Panel aria-labelledby="delete-heading">
        <SectionTitle id="delete-heading" size="lg">
          Delete this racquet
        </SectionTitle>
        <div className={styles.delete}>
          {racquet.inUse ? (
            <>
              {/* The server refuses it too (`in-use`); this only says why the page doesn't offer it. */}
              <Button type="button" disabled aria-describedby="delete-unavailable" className={styles.unavailable}>
                Delete this racquet
              </Button>
              <p id="delete-unavailable" className={styles.note}>
                Tested in a review, so it can&rsquo;t be deleted.
              </p>
            </>
          ) : (
            <>
              <p className={styles.note}>
                Added by mistake, and no setup uses it? You can delete it.
              </p>
              <ConfirmDelete
                summary="Delete this racquet…"
                action={deleteRacquet}
                confirmLabel="Yes, delete this racquet"
                warning={
                  <>
                    This deletes {racquet.name} ({racquet.year}) and its page. It can&rsquo;t be
                    undone.
                  </>
                }
              >
                <input type="hidden" name={RACQUET_FIELDS.slug} value={racquet.slug} />
              </ConfirmDelete>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}

// The page's own login check (the proxy's is only the quick one), and the
// message for the last refused save or delete. After a refused save the page
// reloads with the racquet as it was, so what was typed (and the chosen photo
// or its link) has to be entered again.
async function FormStatus({ slug, searchParams }: Pick<Props, "searchParams"> & { slug: string }) {
  const reviewer = await getCurrentReviewer();
  if (!reviewer) redirect(loginPath(editRacquetPath(slug)));

  const { error } = await searchParams;
  // Only the flags the actions can send, so `?error=constructor` finds nothing.
  const flag = RACQUET_ERROR_FLAGS.find((known) => known === error);
  if (!flag) return null;
  return (
    <FormMessage key={crypto.randomUUID()} tone="error">
      {RACQUET_ERROR_MESSAGES[flag]}{" "}
      {flag === "in-use"
        ? "Nothing was deleted."
        : "Nothing was saved, so the form shows the racquet as it was. Make your changes again, and choose a new photo (or paste its link) again if you were replacing it."}
    </FormMessage>
  );
}
