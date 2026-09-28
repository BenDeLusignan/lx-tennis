import Link from "next/link";
import styles from "./site-header.module.css";

/** Banner for inner pages. The landing page uses its own hero instead. */
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        Tennis Setups
      </Link>
    </header>
  );
}
