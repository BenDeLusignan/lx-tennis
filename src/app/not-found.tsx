import type { Metadata } from "next";
import Link from "next/link";
import { InnerShell } from "@/components/inner-shell";
import styles from "./not-found.module.css";

export const metadata: Metadata = {
  title: "Page not found",
};

// Next renders this outside every route group, so it can't inherit
// app/(inner)/layout.tsx; it uses the same InnerShell directly instead.
export default function NotFound() {
  return (
    <InnerShell>
      <div className={styles.content}>
        <p className={styles.code}>404</p>
        <h1 className={styles.title}>Page not found</h1>
        <p className={styles.text}>That page isn&rsquo;t on the court. It may have moved or never existed.</p>
        <Link href="/racquets">Back to all racquets</Link>
      </div>
    </InnerShell>
  );
}
