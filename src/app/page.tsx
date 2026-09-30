import { AuthStatus } from "@/components/auth-status";
import { RacquetsByBrand } from "@/components/racquets-by-brand";
import { SectionTitle } from "@/components/section-title";
import { getRacquetsByBrand } from "@/data/racquets";
import styles from "./page.module.css";

// The landing page sits outside the (inner) route group: its hero is the
// banner, so it renders its own <header> and <main id="main"> instead of
// <SiteHeader />. It still carries <AuthStatus /> so "Log in" is on every page.
export default async function Home() {
  const brands = await getRacquetsByBrand();

  return (
    <>
      <header className={styles.hero}>
        <div className={styles.account}>
          <AuthStatus />
        </div>
        <h1 className={styles.title}>LX Tennis</h1>
        <p className={styles.tagline}>
          Racquets and string setups we&rsquo;ve tested, with everyone&rsquo;s scores side by side.
        </p>
        <div className={styles.sun} aria-hidden="true" />
      </header>

      <main id="main">
        <SectionTitle>Racquets</SectionTitle>
        <RacquetsByBrand sections={brands} headingLevel="h3" />
      </main>
    </>
  );
}
