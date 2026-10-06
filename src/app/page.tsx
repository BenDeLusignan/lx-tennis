import type { ReactNode } from "react";
import { AuthStatus } from "@/components/auth-status";
import { Panel } from "@/components/panel";
import styles from "./page.module.css";

// The landing page sits outside the (inner) route group: its hero is the
// banner, so it renders its own <header> and <main id="main"> instead of
// <SiteHeader />. It still carries <AuthStatus /> so "Log in" is on every page.
//
// It's the hub (Ben's call): three ways in. Racquet Reviews and String Search
// are built, so those are links; the quiz says "Coming soon" in words (not
// just a muted look) and isn't a link, so nobody taps into a page that isn't
// there. When it's built, swap its entry for a `LiveEntry` and add its page
// to the Rendering notes in docs/vision.md.
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
          <LiveEntry
            id="racquets"
            href="/racquets"
            title="Racquet Reviews"
            cta="See all racquets"
          >
            Every racquet we&rsquo;ve tested, with its official specs and everyone&rsquo;s reviews.
          </LiveEntry>
          <LiveEntry id="strings" href="/strings" title="String Search" cta="Browse strings">
            Pick a string to see every setup it&rsquo;s been in, with everyone&rsquo;s scores.
          </LiveEntry>
          <ComingSoonEntry id="quiz" title="Tennis Quiz">
            A few questions to help find the racquet that suits you.
          </ComingSoonEntry>
        </ul>
      </main>
    </>
  );
}

interface LiveEntryProps {
  /** Makes the heading's and blurb's ids, which name and describe the link. */
  id: string;
  href: string;
  title: string;
  /** The call to action, without its arrow. */
  cta: string;
  children: ReactNode;
}

/**
 * A hub entry that exists: a whole-card link, named by its heading and
 * described by its blurb, so a screen reader's link list says "Racquet
 * Reviews" rather than a sentence.
 */
function LiveEntry({ id, href, title, cta, children }: LiveEntryProps) {
  const titleId = `entry-${id}-title`;
  const textId = `entry-${id}-text`;
  return (
    <li>
      <Panel
        href={href}
        className={`${styles.card} ${styles.live}`}
        aria-labelledby={titleId}
        aria-describedby={textId}
      >
        <h2 id={titleId} className={styles.cardTitle}>
          {title}
        </h2>
        <p id={textId} className={styles.cardText}>
          {children}
        </p>
        <span className={styles.cardCta} aria-hidden="true">
          {cta} &rarr;
        </span>
      </Panel>
    </li>
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
