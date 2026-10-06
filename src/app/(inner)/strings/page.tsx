import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { Panel } from "@/components/panel";
import { SectionTitle } from "@/components/section-title";
import { getStringsByBrand, stringTypeLabel } from "@/data/strings";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Strings",
  description: "Every string on the LX Tennis list. Pick one to see the setups that used it, with everyone's scores.",
};

// Public, and all in the static shell: the list is cached and refreshed
// whenever a string or the strings in use change.
export default async function StringsPage() {
  const brands = await getStringsByBrand();

  return (
    <div className={styles.page}>
      <div>
        <SectionTitle as="h1">Strings</SectionTitle>
        <p className={styles.intro}>
          Pick a string to see every setup it&rsquo;s been in, with everyone&rsquo;s scores.
        </p>
      </div>

      {brands.length === 0 ? (
        <EmptyState title="No strings yet">
          Reviewers add strings when they enter a setup.
        </EmptyState>
      ) : (
        <div className={styles.brands}>
          {brands.map(({ brand, strings }) => {
            // The brand's first string id is stable and unique per section;
            // a slug of the brand isn't (different brands can slug alike).
            const headingId = `brand-${strings[0].id}`;
            return (
              <section key={brand.toLowerCase()} aria-labelledby={headingId}>
                <SectionTitle as="h2" id={headingId} size="lg">
                  {brand}
                </SectionTitle>
                <ul className={styles.list}>
                  {strings.map((string) => {
                    const nameId = `string-${string.id}-name`;
                    const metaId = `string-${string.id}-meta`;
                    return (
                      <li key={string.id}>
                        {/* Named by its text only, brand included for a screen
                            reader that lists links away from their heading. */}
                        <Panel
                          href={`/strings/${string.id}`}
                          className={styles.card}
                          aria-labelledby={`${nameId} ${metaId}`}
                        >
                          <h3 id={nameId} className={styles.name}>
                            <span className="visually-hidden">{string.brand} </span>
                            {string.name}
                          </h3>
                          <span id={metaId} className={styles.meta}>
                            {stringTypeLabel(string.type)}
                            {/* Text with an outline, so the state isn't carried by colour. */}
                            {!string.inUse && <span className={styles.untested}>Not tested yet</span>}
                          </span>
                        </Panel>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
