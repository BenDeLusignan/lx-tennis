import { RacquetList } from "@/components/racquet-list";
import { SectionTitle } from "@/components/section-title";
import { getRacquets } from "@/data/racquets";
import styles from "./page.module.css";

// The landing page sits outside the (inner) route group: its hero is the
// banner, so it renders its own <header> and <main id="main"> instead of
// <SiteHeader />.
export default async function Home() {
  const racquets = await getRacquets();

  return (
    <>
      <header className={styles.hero}>
        <h1 className={styles.title}>LX Tennis Setups</h1>
        <p className={styles.tagline}>
          Racquets and string setups we&rsquo;ve tested, with everyone&rsquo;s scores side by side.
        </p>
        <div className={styles.sun} aria-hidden="true" />
      </header>

      <main id="main">
        <SectionTitle>Racquets</SectionTitle>
        <RacquetList racquets={racquets} headingLevel="h3" />
      </main>
    </>
  );
}
