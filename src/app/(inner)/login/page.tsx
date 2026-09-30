import type { Metadata } from "next";
import { Suspense } from "react";
import { logIn } from "@/auth/actions";
import { safeNextPath } from "@/auth/safe-next-path";
import { Field } from "@/components/field";
import { Input } from "@/components/input";
import { Panel } from "@/components/panel";
import { SectionTitle } from "@/components/section-title";
import { SubmitButton } from "@/components/submit-button";
import { LoginFailed } from "./login-failed";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Log in",
  description: "Reviewer log in for LX Tennis Setups.",
};

type SearchParams = Pick<PageProps<"/login">, "searchParams">;

// The form is in the static shell, so it shows straight away. Only the two
// values that come from the URL stream in, each in its own small
// <Suspense>: where to go afterwards (`?next=`) and whether the last
// attempt failed (`?failed=1`, set by the logIn action).
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Panel aria-labelledby="login-heading" className={styles.panel}>
      <SectionTitle as="h1" id="login-heading" size="lg">
        Reviewer log in
      </SectionTitle>
      <p className={styles.intro}>
        For Ben, Michal and Otavio. Everything on the site can be read without logging in.
      </p>

      <form action={logIn} className={styles.form}>
        <Suspense fallback={null}>
          <NextInput searchParams={searchParams} />
        </Suspense>

        <Field label="Username" htmlFor="username">
          <Input
            id="username"
            name="username"
            type="text"
            required
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby="login-error"
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            aria-describedby="login-error"
          />
        </Field>

        {/* Always in the page (empty until an attempt fails) so screen readers
            announce the message when it's inserted; LoginFailed also moves
            focus to the password field, which reads it out again. */}
        <p id="login-error" role="alert">
          <Suspense fallback={null}>
            <FailureMessage searchParams={searchParams} />
          </Suspense>
        </p>

        <SubmitButton pendingLabel="Logging in…">Log in</SubmitButton>
      </form>
    </Panel>
  );
}

async function NextInput({ searchParams }: SearchParams) {
  const { next } = await searchParams;
  return <input type="hidden" name="next" value={safeNextPath(next)} />;
}

async function FailureMessage({ searchParams }: SearchParams) {
  const { failed } = await searchParams;
  if (failed !== "1") return null;
  // A fresh key per response remounts LoginFailed, so a second failure in a
  // row (same URL, same text) is announced and focused again too.
  return (
    <LoginFailed key={crypto.randomUUID()} className={styles.error}>
      That username and password don&rsquo;t match. Check both and try again.
    </LoginFailed>
  );
}
