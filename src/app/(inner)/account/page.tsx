import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import { Suspense } from "react";
import { changeEmail, changePassword } from "@/auth/actions";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { loginPath } from "@/auth/safe-next-path";
import type { EmailChangeError, PasswordChangeError } from "@/auth/submit";
import { Disclosure } from "@/components/disclosure";
import { Field } from "@/components/field";
import { FormMessage } from "@/components/form-message";
import { Input } from "@/components/input";
import { LogOutButton } from "@/components/log-out-button";
import { Panel } from "@/components/panel";
import { SectionTitle } from "@/components/section-title";
import { SubmitButton } from "@/components/submit-button";
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/data/limits";
import { getReviewerEmail, type Reviewer } from "@/data/reviewers";
import { lockoutMessage } from "@/forms/lockout-message";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Your account",
  description: "Your LX Tennis reviewer account.",
};

type SearchParams = Pick<PageProps<"/account">, "searchParams">;
type Params = Awaited<PageProps<"/account">["searchParams"]>;

// The codes the changePassword action redirects with, each with its own
// message. "locked" isn't listed: its message carries the minutes left, from
// the `wait=minutes` the URL also carries (see `lockoutMessage`).
const CHANGE_ERRORS: Record<Exclude<PasswordChangeError, "locked">, string> = {
  current: "That’s not your current password.",
  short: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
  mismatch: "The two new passwords don’t match.",
  same: "The new password has to be different from your current one.",
  invalid: "Check the form and try again.",
};

// The codes the changeEmail action redirects with, each with its own
// message. "email-locked" is the email form's lockout, worded by
// `lockoutMessage` like "locked".
const EMAIL_ERRORS: Record<Exclude<EmailChangeError, "email-locked">, string> = {
  "email-current": "That’s not your current password.",
  "email-invalid": "That doesn’t look like an email address.",
  // With the site's three reviewers, naming the clash tells a reviewer
  // (who already knows who the others are) that it's a typo'd address of
  // their own, without giving anyone outside anything they could use.
  "email-used": "Another reviewer already uses that email address.",
  "email-same": "That’s already your email address.",
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
      <div className={styles.tools}>
        <p>
          <Link href="/account/strings">Edit the string list</Link>: fix a brand, name or type, or
          delete a string no setup uses.
        </p>
        <p>
          <Link href="/account/racquets">Edit the racquet list</Link>: fix a racquet&rsquo;s details
          or photo, or delete a racquet no setup uses.
        </p>
      </div>

      {/* Email and Change password each start collapsed and open themselves
          when their form has a result to show, so the choice depends on the
          URL's ?saved=1, ?changed=1 or ?error=<flag>, which is only read per
          request. The section therefore streams in as a whole. Its fallback
          is the same section, closed, so the forms are in the static shell
          and nothing moves when the streamed one arrives (closed, the usual
          case). After a submit it arrives open and grows by the form's
          height; that can't be avoided for a section that must start open,
          and FormMessage scrolls to its message anyway. */}
      <div className={styles.sections}>
        <Suspense fallback={<EmailSection />}>
          <EmailSectionWithResult searchParams={searchParams} />
        </Suspense>
        <Suspense fallback={<PasswordSection />}>
          <PasswordSectionWithResult searchParams={searchParams} />
        </Suspense>
      </div>

      <LogOutButton />
    </Panel>
  );
}

async function CurrentAccountDetails() {
  // The real check. The proxy only looks at the cookie, so a session ended
  // by a password reset still gets this far and is sent to log in here.
  const reviewer = await getCurrentReviewer();
  if (!reviewer) redirect(loginPath("/account"));

  // The email is private, so it's read here per request, never in the
  // static shell (the panel above renders before the session is known).
  const email = await getReviewerEmail(reviewer.id);
  return <AccountDetails reviewer={reviewer} email={email} />;
}

function AccountDetails({ reviewer, email }: { reviewer?: Reviewer; email?: string | null }) {
  return (
    <dl className={styles.details}>
      <dt className={styles.label}>Name</dt>
      <dd className={styles.value}>{reviewer?.displayName}</dd>
      <dt className={styles.label}>Username</dt>
      <dd className={styles.value}>{reviewer?.username}</dd>
      <dt className={styles.label}>Email</dt>
      {/* "No email yet" is also the streaming fallback's text, so the row
          keeps its height while the panel loads. */}
      <dd className={styles.value}>{email ?? "No email yet"}</dd>
    </dl>
  );
}

// The two sections below are the same markup in the static shell (closed, no
// message) and once streamed in (open when there's a message). Keep them
// that way: the swap should only ever add the message and the `open`.

// The field stays empty in the static shell on purpose: the current address
// is private, so it streams in with the details panel above.
function EmailSection({ message = null }: { message?: ReactElement | null }) {
  return (
    <Disclosure title="Email" open={message !== null}>
      <form action={changeEmail} className={styles.form}>
        <Field label="Email address" htmlFor="email-address">
          <Input
            id="email-address"
            name="email"
            type="email"
            required
            maxLength={EMAIL_MAX_LENGTH}
            autoComplete="email"
            aria-describedby="email-hint email-form-message"
          />
          <p id="email-hint" className={styles.hint}>
            The email address you log in with. Later it will also reset a forgotten
            password; no email is sent yet.
          </p>
        </Field>
        <Field label="Current password" htmlFor="email-current-password">
          <Input
            id="email-current-password"
            name="currentPassword"
            type="password"
            required
            maxLength={PASSWORD_MAX_LENGTH}
            autoComplete="current-password"
            aria-describedby="email-form-message"
          />
        </Field>

        {/* Always here (empty until a change has a result) so the fields'
            aria-describedby stays valid; FormMessage moves focus to itself
            when it's inserted, as with the password form below. A div, not
            a p: FormMessage renders its own <p>, and a p can't contain one. */}
        <div id="email-form-message">{message}</div>

        <SubmitButton pendingLabel="Saving…">Save email</SubmitButton>
      </form>
    </Disclosure>
  );
}

function PasswordSection({ message = null }: { message?: ReactElement | null }) {
  return (
    <Disclosure title="Change password" open={message !== null}>
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

        {/* Always here, for the same reason as the email form's. */}
        <div id="password-form-message">{message}</div>

        <SubmitButton pendingLabel="Changing…">Change password</SubmitButton>
      </form>
    </Disclosure>
  );
}

// Each form reads only its own result from the URL after the action's
// redirect (the two share the `?error=` query string; each only knows its own
// codes, so they can't collide). A fresh key per response remounts
// FormMessage, so the same message twice in a row is focused again.
async function EmailSectionWithResult({ searchParams }: SearchParams) {
  return <EmailSection message={emailFormMessage(await searchParams)} />;
}

async function PasswordSectionWithResult({ searchParams }: SearchParams) {
  return <PasswordSection message={passwordFormMessage(await searchParams)} />;
}

function passwordFormMessage({ changed, error, wait }: Params): ReactElement | null {
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
      {error === "locked" ? lockoutMessage(wait) : CHANGE_ERRORS[error]} Nothing was changed, so the
      fields are empty again.
    </FormMessage>
  );
}

function isPasswordChangeError(value: string): value is PasswordChangeError {
  return value === "locked" || Object.hasOwn(CHANGE_ERRORS, value);
}

function emailFormMessage({ saved, error, wait }: Params): ReactElement | null {
  if (saved === "1") {
    return (
      <FormMessage key={crypto.randomUUID()} tone="success">
        Your email address has been saved.
      </FormMessage>
    );
  }
  if (typeof error !== "string" || !isEmailChangeError(error)) return null;
  return (
    <FormMessage key={crypto.randomUUID()} tone="error">
      {error === "email-locked" ? lockoutMessage(wait) : EMAIL_ERRORS[error]} Nothing was changed, so
      the fields are empty again.
    </FormMessage>
  );
}

function isEmailChangeError(value: string): value is EmailChangeError {
  return value === "email-locked" || Object.hasOwn(EMAIL_ERRORS, value);
}