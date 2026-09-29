import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { Panel } from "@/components/panel";
import { RacquetPhoto } from "@/components/racquet-photo";
import { SectionTitle } from "@/components/section-title";
import { getRacquet, getRacquetSlugs } from "@/data/racquets";
import styles from "./page.module.css";

// Every racquet is prerendered from this list. Cache Components doesn't
// allow `dynamicParams = false`, so an unknown slug renders on request and
// gets the 404 from the notFound() below.
//
// `instant = false`: the page awaits `params` at the top, which only blocks
// for slugs not in this list, and those are all 404s. Wrapping the page in
// <Suspense> instead would add a loading state for nothing.
export const instant = false;

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

// The data keeps the manufacturer's number as published (Babolat gives
// 10.7586 oz); the page always shows 1 dp, matching Yonex's published values.
const oneDecimal = new Intl.NumberFormat("en", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export default async function RacquetPage({ params }: PageProps<"/racquets/[slug]">) {
  const { slug } = await params;
  const racquet = await getRacquet(slug);
  if (!racquet) notFound();

  const { specs } = racquet;
  const specRows: [label: string, value: string][] = [
    ["Head size", `${specs.headSizeSqIn} sq in`],
    [
      "Weight (unstrung)",
      `${specs.unstrungWeight.grams} g / ${oneDecimal.format(specs.unstrungWeight.ounces)} oz`,
    ],
    ["Balance", `${specs.balanceMm} mm`],
    ["Length", `${specs.lengthIn} in`],
    ["String pattern", `${specs.stringPattern.mains} × ${specs.stringPattern.crosses}`],
  ];

  // Source order is the reading order on every screen: title, photo, Reviews,
  // Specs. Reviews come before Specs because at the court the scores are what
  // you came for. The CSS only moves the photo between layouts.
  return (
    <div className={styles.page}>
      <Link href="/racquets" className={styles.back}>
        <span aria-hidden="true">&larr;</span> All racquets
      </Link>

      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{racquet.name}</h1>
        <p className={styles.meta}>
          {racquet.generation ? `${racquet.year} · ${racquet.generation}` : racquet.year}
        </p>
      </div>

      {/* `sizes` tracks .photo's width in page.module.css. */}
      <RacquetPhoto
        image={racquet.image}
        sizes="(min-width: 56rem) 22rem, 6rem"
        preload
        className={styles.photo}
      />

      <Panel aria-labelledby="reviews-heading" className={styles.reviews}>
        <SectionTitle id="reviews-heading" size="lg">
          Reviews
        </SectionTitle>
        <EmptyState title="No reviews yet">
          When someone tests a setup on this racquet, their scores and notes will appear here side
          by side.
        </EmptyState>
      </Panel>

      <Panel aria-labelledby="specs-heading" className={styles.specs}>
        <SectionTitle id="specs-heading" size="lg">
          Specs
        </SectionTitle>
        <table className={styles.specsTable}>
          <caption className="visually-hidden">
            Official {racquet.brand} specifications for the {racquet.name} ({racquet.year})
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
      </Panel>
    </div>
  );
}
