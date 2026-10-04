import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { changePassword } from "@/auth/actions";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { loginPath } from "@/auth/safe-next-path";
import type { PasswordChangeError } from "@/auth/submit";
import { Field } from "@/components/field";
import { FormMessage } from "@/components/form-message";
import { Input } from "@/components/input";
import { LogOutButton } from "@/components/log-out-button";
import { Panel } from "@/components/panel";
import { SectionTitle } from "@/components/section-title";
import { SubmitButton } from "@/components/submit-button";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/data/limits";
import type { Reviewer } from "@/data/reviewers";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Your account",
  description: "Your LX Tennis reviewer account.",
};

type SearchParams = Pick<PageProps<"/account">, "searchParams">;

// The codes the changePassword action redirects with, each with its own message.
const CHANGE_ERRORS: Record<PasswordChangeError, string> = {
  current: "That’s not your current password.",
  short: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
  mismatch: "The two new passwords don’t match.",
  same: "The new password has to be different from your current one.",
  invalid: "Check the form and try again.",
};

// Reviewers only. Visitors never get here: src/proxy.ts sends them to the
// login page first. Everything but a few values is in the static shell; they
// stream in behind small <Suspense> boundaries, whose fallbacks keep the
// page's shape, so nothing moves when they arrive.
export default function AccountPage({ searchParams }: PageProps<"/account">) {
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

      <SectionTitle as="h2" id="change-password-heading" size="lg">
        Change password
      </SectionTitle>
      {/* The form is in the static shell, so it shows straight away; only
          the result of the last change streams in, from ?changed=1 or
          ?error=<flag> in the URL. */}
      <form action={changePassword} className={styles.form}>
        <Field label="Current password" htmlFor="current-password">
          <Input
            id="current-password"
            name="currentPassword"
            type="password"
            required
            maxLength={PASSWORD_MAX_LENGTH}
            autoComplete="current-password"
            aria-describedby="password-form-message"
          />
        </Field>
        <Field label="New password" htmlFor="new-password">
          <Input
            id="new-password"
            name="newPassword"
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            autoComplete="new-password"
            aria-describedby="new-password-hint password-form-message"
          />
          <p id="new-password-hint" className={styles.hint}>
            At least {PASSWORD_MIN_LENGTH} characters.
          </p>
        </Field>
        <Field label="Confirm new password" htmlFor="confirm-password">
          <Input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            autoComplete="new-password"
            aria-describedby="password-form-message"
          />
        </Field>

        {/* Always here (empty until a change fails) so the message's
            aria-describedby stays valid; FormMessage moves focus to itself
            when it's inserted. A div, not a p: FormMessage renders its own
            <p>, and a p can't contain one. */}
        <div id="password-form-message">
          <Suspense fallback={null}>
            <PasswordFormStatus searchParams={searchParams} />
          </Suspense>
        </div>

        <SubmitButton pendingLabel="Changing…">Change password</SubmitButton>
      </form>

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

// The result of the last change, read from the URL after the action's
// redirect; a fresh key per response remounts FormMessage, so the same
// message twice in a row is focused again.
async function PasswordFormStatus({ searchParams }: SearchParams) {
  const { changed, error } = await searchParams;
  if (changed === "1") {
    return (
      <FormMessage key={crypto.randomUUID()} tone="success">
        Your password has been changed. Other devices are logged out.
      </FormMessage>
    );
  }
  // Own keys only, so `?error=constructor` can't find Object's; the guard
  // also narrows the URL's string to a code the form knows.
  if (typeof error !== "string" || !isPasswordChangeError(error)) return null;
  return (
    <FormMessage key={crypto.randomUUID()} tone="error">
      {CHANGE_ERRORS[error]} Nothing was changed, so the fields are empty again.
    </FormMessage>
  );
}

function isPasswordChangeError(value: string): value is PasswordChangeError {
  return Object.hasOwn(CHANGE_ERRORS, value);
}