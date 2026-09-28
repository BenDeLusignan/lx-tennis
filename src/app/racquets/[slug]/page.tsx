import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RacquetPhoto } from "@/components/racquet-photo";
import { SiteHeader } from "@/components/site-header";
import { getRacquet, getRacquetSlugs } from "@/data/racquets";
import styles from "./page.module.css";

// Only the slugs from generateStaticParams exist; anything else is a 404.
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = await getRacquetSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/racquets/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const racquet = await getRacquet(slug);
  if (!racquet) return {};
  return {
    title: `${racquet.name} (${racquet.year})`,
    description: `Official specs and reviews for the ${racquet.name} (${racquet.year}).`,
  };
}

export default async function RacquetPage({ params }: PageProps<"/racquets/[slug]">) {
  const { slug } = await params;
  const racquet = await getRacquet(slug);
  if (!racquet) notFound();

  const { specs } = racquet;
  const specRows: [label: string, value: string][] = [
    ["Head size", `${specs.headSizeSqIn} sq in`],
    [
      "Weight (unstrung)",
      `${specs.unstrungWeight.grams} g / ${specs.unstrungWeight.ounces} oz`,
    ],
    ["Balance", `${specs.balanceMm} mm`],
    ["Length", `${specs.lengthIn} in`],
    ["String pattern", `${specs.stringPattern.mains} × ${specs.stringPattern.crosses}`],
  ];

  return (
    <>
      <SiteHeader />
      <main id="main" className={styles.main}>
        <Link href="/" className={styles.back}>
          <span aria-hidden="true">&larr;</span> All racquets
        </Link>

        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{racquet.name}</h1>
          <p className={styles.meta}>
            {racquet.generation ? `${racquet.year} · ${racquet.generation}` : racquet.year}
          </p>
        </div>

        <div className={styles.layout}>
          <RacquetPhoto
            image={racquet.image}
            sizes="(min-width: 56rem) 22rem, 14rem"
            preload
            className={styles.photo}
          />

          <div className={styles.details}>
            <section aria-labelledby="specs-heading" className={styles.panel}>
              <h2 id="specs-heading" className={styles.panelTitle}>
                Specs
              </h2>
              <table className={styles.specs}>
                <caption className="visually-hidden">
                  Official Yonex specifications for the {racquet.name} ({racquet.year})
                </caption>
                <tbody>
                  {specRows.map(([label, value]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section aria-labelledby="reviews-heading" className={styles.panel}>
              <h2 id="reviews-heading" className={styles.panelTitle}>
                Reviews
              </h2>
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>No reviews yet</p>
                <p>
                  When someone tests a setup on this racquet, their scores and notes will appear
                  here side by side.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
