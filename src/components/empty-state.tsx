import type { ReactNode } from "react";
import styles from "./empty-state.module.css";

interface EmptyStateProps {
  /** What's missing, stated plainly (e.g. "No reviews yet"). */
  title: string;
  /** Optional line on what will appear here, and when. */
  children?: ReactNode;
  /** `compact` for a one-line slot in a list (an empty brand), so empties don't pad out a phone's scroll. */
  size?: "default" | "compact";
}

/**
 * The dashed "nothing here yet" box. Product rule 9: when there's no data we
 * say so honestly instead of showing placeholder content.
 */
export function EmptyState({ title, children, size = "default" }: EmptyStateProps) {
  return (
    <div className={`${styles.empty} ${styles[size]}`}>
      <p className={styles.title}>{title}</p>
      {children && <p>{children}</p>}
    </div>
  );
}
