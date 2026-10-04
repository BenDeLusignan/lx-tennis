import type { ReactNode } from "react";
import { SectionTitle } from "./section-title";
import styles from "./disclosure.module.css";

interface DisclosureProps {
  /** The section's name: the summary's text, and its heading for screen readers. */
  title: string;
  /** Pick the level that keeps the page's headings in order; the look stays the same. */
  as?: "h2" | "h3";
  /** Start expanded. Collapsed unless the caller has a reason to show the content. */
  open?: boolean;
  children: ReactNode;
}

/**
 * A section that starts collapsed behind its heading, for a form or other
 * content the reader only sometimes needs (the account page's Email and
 * Change password forms). Pass `open` when the content has something to say
 * right now, such as a form's error or success message, so it isn't hidden.
 *
 * A native `<details>`, so it opens and closes by tap and keyboard (Enter or
 * Space on the summary) before any JavaScript has loaded, and it's a server
 * component: no script is needed for it. The heading sits inside the
 * `<summary>` (HTML allows that), so the section stays in the page's heading
 * outline and the summary's text is the section's name.
 *
 * `open` is only the initial state: a reader's own toggling after that is the
 * browser's, and React leaves the attribute alone until `open` changes.
 */
export function Disclosure({ title, as = "h2", open, children }: DisclosureProps) {
  return (
    <details className={styles.disclosure} open={open}>
      <summary className={styles.summary}>
        <SectionTitle as={as} size="lg" className={styles.title}>
          {title}
        </SectionTitle>
      </summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}
