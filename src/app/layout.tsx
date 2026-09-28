import type { Metadata } from "next";
import { Geist, Orbitron } from "next/font/google";
import styles from "./layout.module.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "LX Tennis Setups",
    template: "%s · LX Tennis Setups",
  },
  description:
    "Racquet and string setups tested by Ben and friends, with everyone's scores and reviews side by side.",
};

// Each page renders its own <header> and <main id="main">, so the landing page
// can use its hero as the banner while inner pages use <SiteHeader />.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${orbitron.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className={styles.page}>{children}</div>
        <footer className={styles.footer}>
          <p>Racquet photos and specs from Yonex&rsquo;s official product pages.</p>
        </footer>
      </body>
    </html>
  );
}
