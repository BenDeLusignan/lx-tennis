import { AuthStatus } from "@/components/auth-status";
import { Panel } from "@/components/panel";
import styles from "./page.module.css";

// The landing page sits outside the (inner) route group: its hero is the
// banner, so it renders its own <header> and <main id="main"> instead of
// <SiteHeader />. It still carries <AuthStatus /> so "Log in" is on every page.
//
// It's the hub (Ben's call): three ways in. Only the racquet reviews exist, so
// that one is a link; the other two say "Coming soon" in words (not just a
// muted look) and aren't links, so nobody taps into a page that isn't there.
// When one is built, swap its entry for a linked card like the racquets one
// and add its page to the Rendering notes in docs/vision.md.
//
// The page reads nothing per request, so it stays whole in the static shell.
// The h2s sit directly under the h1 (the site name in the hero).
export default function Home() {
  return (
    <>
      <header className={styles.hero}>
        <div className={styles.account}>
          <AuthStatus />
        </div>
        <h1 className={styles.title}>LX Tennis</h1>
        <div className={styles.sun} aria-hidden="true" />
      </header>

      <main id="main">
        <ul className={styles.entries}>
          <li>
            {/* Named by its heading and described by its blurb, so a screen
                reader's link list says "Racquet Reviews" rather than a sentence. */}
            <Panel
              href="/racquets"
              className={`${styles.card} ${styles.live}`}
              aria-labelledby="entry-racquets-title"
              aria-describedby="entry-racquets-text"
            >
              <h2 id="entry-racquets-title" className={styles.cardTitle}>
                Racquet Reviews
              </h2>
              <p id="entry-racquets-text" className={styles.cardText}>
                Every racquet we&rsquo;ve tested, with its official specs and everyone&rsquo;s reviews.
              </p>
              <span className={styles.cardCta} aria-hidden="true">
                See all racquets &rarr;
              </span>
            </Panel>
          </li>
          <ComingSoonEntry id="strings" title="String Reviews">
            The strings we&rsquo;ve tried, and how they play.
          </ComingSoonEntry>
          <ComingSoonEntry id="quiz" title="Tennis Quiz">
            A few questions to help find the racquet that suits you.
          </ComingSoonEntry>
        </ul>
      </main>
    </>
  );
}

interface ComingSoonEntryProps {
  /** Makes the heading's id, which names the section. */
  id: string;
  title: string;
  children: string;
}

/**
 * A hub entry for something not built yet: a plain block (no link, no hover),
 * with "Coming soon" as visible text right under the heading so it reads
 * before the blurb and isn't conveyed by the muted look alone.
 */
function ComingSoonEntry({ id, title, children }: ComingSoonEntryProps) {
  const titleId = `entry-${id}-title`;
  return (
    <li>
      <Panel aria-labelledby={titleId} className={`${styles.card} ${styles.soon}`}>
        <h2 id={titleId} className={styles.cardTitle}>
          {title}
        </h2>
        <p className={styles.badge}>Coming soon</p>
        <p className={styles.cardText}>{children}</p>
      </Panel>
    </li>
  );
}
