import type { ReactNode } from "react";
import { AuthStatus } from "@/components/auth-status";
import { Panel } from "@/components/panel";
import styles from "./page.module.css";

// The landing page sits outside the (inner) route group: its hero is the
// banner, so it renders its own <header> and <main id="main"> instead of
// <SiteHeader />. It still carries <AuthStatus /> so "Log in" is on every page,
// and the hero lays its top band out like the inner header, so the login state
// doesn't move when you go between `/` and another page (see page.module.css).
//
// It's the hub (Ben's call): four ways in, all built, so all four are links.
// Ben's order: Add a Review, Search by Racquet, Search by String, then the
// quiz, which sits on its own centred row from 48rem. The first three come
// first so they sit near the top of a phone screen.
//
// The page reads nothing per request, so it stays whole in the static shell.
// Add a Review is shown to everyone: a visitor who follows it is sent to log
// in by the proxy and comes back to the chooser. The h2s sit directly under
// the h1 (the site name in the hero).
export default function Home() {
  return (
    <>
      <header className={styles.hero}>
        <h1 className={styles.title}>LX Tennis</h1>
        <div className={styles.account}>
          <AuthStatus />
        </div>
        <div className={styles.sun} aria-hidden="true" />
      </header>

      <main id="main">
        <ul className={styles.entries}>
          <LiveEntry
            id="add-review"
            href="/account/add-review"
            title="Add a Review"
            cta="Choose a racquet"
          >
            Tested a setup? Pick the racquet, then enter the strings and your scores.
          </LiveEntry>
          <LiveEntry
            id="racquets"
            href="/racquets"
            title="Search by Racquet"
            cta="See all racquets"
          >
            Every racquet we&rsquo;ve tested, with its official specs and everyone&rsquo;s reviews.
          </LiveEntry>
          <LiveEntry id="strings" href="/strings" title="Search by String" cta="Browse strings">
            Pick a string to see every setup it&rsquo;s been in, with everyone&rsquo;s scores.
          </LiveEntry>
          <LiveEntry
            id="quiz"
            href="/quiz"
            title="Tennis Quiz"
            cta="Take the quiz"
            className={styles.quiz}
          >
            A few questions to help find the racquet that suits you.
          </LiveEntry>
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
  /** Placement in the list only (e.g. the quiz's own row), as with Button. */
  className?: string;
  children: ReactNode;
}

/**
 * A hub entry that exists: a whole-card link, named by its heading and
 * described by its blurb, so a screen reader's link list says "Search by
 * Racquet" rather than a sentence.
 */
function LiveEntry({ id, href, title, cta, className, children }: LiveEntryProps) {
  const titleId = `entry-${id}-title`;
  const textId = `entry-${id}-text`;
  return (
    <li className={className}>
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
