import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Panel } from "@/components/panel";
import { SectionTitle } from "@/components/section-title";
import { SetupCard } from "@/components/setup-card";
import { getRacquetsByBrand } from "@/data/racquets";
import { getStringSetups } from "@/data/setups";
import { getStrings, stringTypeLabel, type TennisString } from "@/data/strings";
import { parseId } from "@/forms/fields";
import styles from "./page.module.css";

// Every string on the list is prerendered from this. Cache Components doesn't
// allow `dynamicParams = false`, so an id that isn't listed (a string added
// since the build, or one that never existed) renders on request, and gets
// the 404 from notFound() below if there's no such string.
//
// `instant = false`: the page awaits `params` at the top, which only blocks
// for ids not in this list, and those are a new string or a 404. Wrapping
// the page in <Suspense> instead would add a loading state for nothing.
export const instant = false;

export async function generateStaticParams() {
  const strings = await getStrings();
  return strings.map(({ id }) => ({ id: String(id) }));
}

/** The string for the URL's id, or undefined for a malformed or unknown id. */
async function findString(id: string): Promise<TennisString | undefined> {
  const stringId = parseId(id);
  if (stringId === null) return undefined;
  // The one cached list, not a reader per id: a stranger's guesses can't fill the cache.
  return (await getStrings()).find((string) => string.id === stringId);
}

export async function generateMetadata({ params }: PageProps<"/strings/[id]">): Promise<Metadata> {
  const found = await findString((await params).id);
  if (!found) return {};
  const name = `${found.brand} ${found.name}`;
  return {
    title: name,
    description: `The setups that used ${name}, with everyone's scores side by side.`,
  };
}

export default async function StringPage({ params }: PageProps<"/strings/[id]">) {
  const found = await findString((await params).id);
  if (!found) notFound();

  // All cached and refreshed when something is saved, so the cards are in
  // the static shell. The catalogue gives the racquets' names and their order.
  const [setups, brands] = await Promise.all([getStringSetups(found.id), getRacquetsByBrand()]);

  // By racquet, in the catalogue's order; within one, newest strung first
  // (the order `getStringSetups` returns). A setup's racquet always exists.
  const groups = brands
    .flatMap(({ racquets }) => racquets)
    .map((racquet) => ({
      racquet,
      setups: setups.filter((setup) => setup.racquetSlug === racquet.slug),
    }))
    .filter((group) => group.setups.length > 0);

  const typeLabel = stringTypeLabel(found.type);

  return (
    <div className={styles.page}>
      <div>
        <BackLink href="/strings">All strings</BackLink>
        <SectionTitle as="h1" className={styles.title}>
          {found.brand} {found.name}
        </SectionTitle>
        <p className={styles.meta}>
          {typeLabel}
          {setups.length > 0 && ` · ${setups.length} ${setups.length === 1 ? "setup" : "setups"}`}
        </p>
      </div>

      {groups.length > 0 ? (
        groups.map(({ racquet, setups: racquetSetups }) => {
          const headingId = `racquet-${racquet.slug}-heading`;
          return (
            <Panel key={racquet.slug} aria-labelledby={headingId}>
              {/* The racquet's name, and the way to its page. */}
              <div className={styles.groupHeader}>
                <SectionTitle as="h2" id={headingId} size="lg" className={styles.groupTitle}>
                  {racquet.name}
                  <span className={styles.year}>
                    {" "}
                    ({racquet.generation ? `${racquet.year} · ${racquet.generation}` : racquet.year})
                  </span>
                </SectionTitle>
                <Button href={`/racquets/${racquet.slug}`}>
                  View racquet
                  <span className="visually-hidden"> {racquet.name}</span>
                </Button>
              </div>
              <div className={styles.setups}>
                {racquetSetups.map((setup) => (
                  <SetupCard key={setup.id} setup={setup} />
                ))}
              </div>
            </Panel>
          );
        })
      ) : (
        <EmptyState title="Not tested yet">
          No setup with this string has been reviewed yet. When someone tests one, it will appear
          here with everyone&rsquo;s scores.
        </EmptyState>
      )}
    </div>
  );
}
