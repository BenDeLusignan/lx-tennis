import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { AddReviewButton } from "@/components/add-review-button";
import { BackLink } from "@/components/back-link";
import { Button } from "@/components/button";
import { EditReviewLink } from "@/components/edit-review-link";
import { EmptyState } from "@/components/empty-state";
import { Panel } from "@/components/panel";
import { RacquetPhoto } from "@/components/racquet-photo";
import { SectionTitle } from "@/components/section-title";
import { SetupCard } from "@/components/setup-card";
import { getRacquet, getRacquetSlugs } from "@/data/racquets";
import { getReviewers } from "@/data/reviewers";
import { getRacquetSetups } from "@/data/setups";
import styles from "./page.module.css";

// Every racquet is prerendered from this list. Cache Components doesn't
// allow `dynamicParams = false`, so an unknown slug renders on request and
// gets the 404 from the notFound() below.
//
// `instant = false`: the page awaits `params` at the top, which only blocks
// for slugs not in this list, and those are all 404s. Wrapping the page in
// <Suspense> instead would add a loading state for nothing.
export const instant = false;

export async function generateStaticParams() {
  const slugs = await getRacquetSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/racquets/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const racquet = await getRacquet(slug);
  if (!racquet) return {};
  return {
    title: `${racquet.name} (${racquet.year})`,
    description: `Official specs and reviews for the ${racquet.name} (${racquet.year}).`,
  };
}

export default async function RacquetPage({ params }: PageProps<"/racquets/[slug]">) {
  const { slug } = await params;
  const racquet = await getRacquet(slug);
  if (!racquet) notFound();

  // Both cached and refreshed when something is saved, so the cards are in
  // the static shell; only the reviewer's buttons stream in.
  const [setups, reviewers] = await Promise.all([getRacquetSetups(slug), getReviewers()]);

  // A spec the manufacturer doesn't publish is null and its row is left out,
  // never guessed (Product rule 11). Weight is grams only (Ben's decision).
  const { specs } = racquet;
  const specRows: [label: string, value: string | null][] = [
    ["Head size", specs.headSizeSqIn !== null ? `${specs.headSizeSqIn} sq in` : null],
    ["Weight (unstrung)", specs.weightGrams !== null ? `${specs.weightGrams} g` : null],
    ["Balance", specs.balanceMm !== null ? `${specs.balanceMm} mm` : null],
    ["Length", specs.lengthIn !== null ? `${specs.lengthIn} in` : null],
    [
      "String pattern",
      specs.stringPattern ? `${specs.stringPattern.mains} × ${specs.stringPattern.crosses}` : null,
    ],
  ];
  const shownSpecs = specRows.filter(([, value]) => value !== null);

  // Source order is the reading order on every screen: title, photo, Reviews,
  // Specs. Reviews come before Specs because at the court the scores are what
  // you came for. The CSS only moves the photo between layouts.
  return (
    <div className={styles.page}>
      <BackLink href="/racquets" className={styles.back}>
        All racquets
      </BackLink>

      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{racquet.name}</h1>
        <p className={styles.meta}>
          {racquet.generation ? `${racquet.year} · ${racquet.generation}` : racquet.year}
        </p>
      </div>

      {/* `sizes` tracks .photo's width in page.module.css. */}
      <RacquetPhoto
        image={racquet.image}
        sizes="(min-width: 56rem) 22rem, 6rem"
        preload
        className={styles.photo}
      />

      <Panel aria-labelledby="reviews-heading" className={styles.reviews}>
        {/* The row keeps a button's height whether or not "Add a setup"
            streams in, so the cards below never jump. */}
        <div className={styles.reviewsHeader}>
          <SectionTitle id="reviews-heading" size="lg" className={styles.reviewsTitle}>
            Reviews
          </SectionTitle>
          <Suspense fallback={null}>
            <AddSetupButton slug={slug} />
          </Suspense>
        </div>

        {setups.length > 0 ? (
          <div className={styles.setups}>
            {setups.map((setup) => (
              <SetupCard key={setup.id} setup={setup} reviewers={reviewers}>
                {/* At the foot of the card: for visitors there's nothing
                    here, and a gap kept free for a button they'll never
                    see would waste a phone's height on every card. */}
                <AddReviewButton
                  setup={setup}
                  className={styles.cardAction}
                  whenReviewed={<EditReviewLink setup={setup} className={styles.cardAction} />}
                />
              </SetupCard>
            ))}
          </div>
        ) : (
          <EmptyState title="No reviews yet">
            When someone tests a setup on this racquet, their scores and notes will appear here side
            by side.
          </EmptyState>
        )}
      </Panel>

      <Panel aria-labelledby="specs-heading" className={styles.specs}>
        <SectionTitle id="specs-heading" size="lg">
          Specs
        </SectionTitle>
        {shownSpecs.length > 0 ? (
          <table className={styles.specsTable}>
            <caption className="visually-hidden">
              {racquet.brand} specifications for the {racquet.name} ({racquet.year})
            </caption>
            <tbody>
              {shownSpecs.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="No specs yet">
            No official specs have been entered for this racquet.
          </EmptyState>
        )}
      </Panel>
    </div>
  );
}

// Reviewers only, and only a way in: the form's page and its action check
// the login for themselves.
async function AddSetupButton({ slug }: { slug: string }) {
  const reviewer = await getCurrentReviewer();
  if (!reviewer) return null;
  return <Button href={`/account/racquets/${slug}/new`}>Add a setup</Button>;
}
