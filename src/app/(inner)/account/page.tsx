import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { loginPath } from "@/auth/safe-next-path";
import { LogOutButton } from "@/components/log-out-button";
import { Panel } from "@/components/panel";
import { SectionTitle } from "@/components/section-title";
import type { Reviewer } from "@/data/reviewers";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Your account",
  description: "Your LX Tennis reviewer account.",
};

// Reviewers only. Visitors never get here: src/proxy.ts sends them to the
// login page first. Everything but the two values is in the static shell;
// they stream in behind one small <Suspense>, whose fallback is the same
// list with the values blank, so nothing moves when they arrive.
export default function AccountPage() {
  return (
    <Panel aria-labelledby="account-heading" className={styles.panel}>
      <SectionTitle as="h1" id="account-heading" size="lg">
        Your account
      </SectionTitle>
      <Suspense fallback={<AccountDetails />}>
        <CurrentAccountDetails />
      </Suspense>
      <p className={styles.tools}>
        <Link href="/account/strings">Edit the string list</Link>: fix a brand, name or type, or
        delete a string no setup uses.
      </p>
      <LogOutButton />
    </Panel>
  );
}

async function CurrentAccountDetails() {
  // The real check. The proxy only looks at the cookie, so a session ended
  // by a password reset still gets this far and is sent to log in here.
  const reviewer = await getCurrentReviewer();
  if (!reviewer) redirect(loginPath("/account"));

  return <AccountDetails reviewer={reviewer} />;
}

function AccountDetails({ reviewer }: { reviewer?: Reviewer }) {
  return (
    <dl className={styles.details}>
      <dt className={styles.label}>Name</dt>
      <dd className={styles.value}>{reviewer?.displayName}</dd>
      <dt className={styles.label}>Username</dt>
      <dd className={styles.value}>{reviewer?.username}</dd>
    </dl>
  );
}
