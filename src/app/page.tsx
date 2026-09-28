import Link from "next/link";
import { RacquetPhoto } from "@/components/racquet-photo";
import { getRacquets } from "@/data/racquets";
import styles from "./page.module.css";

export default async function Home() {
  const racquets = await getRacquets();

  return (
    <>
      <header className={styles.hero}>
        <h1 className={styles.title}>Tennis Setups</h1>
        <p className={styles.tagline}>
          Racquets and string setups we&rsquo;ve tested, with everyone&rsquo;s scores side by side.
        </p>
        <div className={styles.sun} aria-hidden="true" />
      </header>

      <main id="main">
        <h2 className={styles.sectionTitle}>Racquets</h2>
        <ul className={styles.grid}>
          {racquets.map((racquet) => (
            <li key={racquet.slug}>
              {/* Name the link by its text only; the photo keeps its own alt text. */}
              <Link
                href={`/racquets/${racquet.slug}`}
                className={styles.card}
                aria-labelledby={`${racquet.slug}-name ${racquet.slug}-meta`}
              >
                <RacquetPhoto
                  image={racquet.image}
                  sizes="(min-width: 48rem) 20rem, 7rem"
                  className={styles.photo}
                />
                <div className={styles.cardText}>
                  <h3 id={`${racquet.slug}-name`} className={styles.cardName}>
                    {racquet.name}
                  </h3>
                  <span id={`${racquet.slug}-meta`} className={styles.cardMeta}>
                    {racquet.generation ? `${racquet.year} · ${racquet.generation}` : racquet.year}
                  </span>
                  <span className={styles.cardCta} aria-hidden="true">
                    View details &rarr;
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
