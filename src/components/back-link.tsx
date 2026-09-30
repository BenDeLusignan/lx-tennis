import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./back-link.module.css";

interface BackLinkProps {
  href: string;
  /** Where it goes, e.g. "All racquets" or the racquet's name. */
  children: ReactNode;
  /** Placement only (e.g. `grid-area`), as with Button. */
  className?: string;
}

/** The "← somewhere" link at the top of a page, back up the core flow. */
export function BackLink({ href, children, className }: BackLinkProps) {
  return (
    <Link href={href} className={className ? `${styles.back} ${className}` : styles.back}>
      <span aria-hidden="true">&larr;</span> {children}
    </Link>
  );
}
