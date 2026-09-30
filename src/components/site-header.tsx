import Link from "next/link";
import { AuthStatus } from "@/components/auth-status";
import styles from "./site-header.module.css";

/** Banner for inner pages. The landing page uses its own hero instead. */
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        LX Tennis
      </Link>
      <AuthStatus />
    </header>
  );
}
