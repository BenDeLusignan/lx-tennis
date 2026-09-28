import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import styles from "./not-found.module.css";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className={styles.main}>
        <p className={styles.code}>404</p>
        <h1 className={styles.title}>Page not found</h1>
        <p className={styles.text}>That page isn&rsquo;t on the court. It may have moved or never existed.</p>
        <Link href="/">Back to all racquets</Link>
      </main>
    </>
  );
}
