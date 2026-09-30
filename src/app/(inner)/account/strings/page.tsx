import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { loginPath } from "@/auth/safe-next-path";
import { BackLink } from "@/components/back-link";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/field";
import { FormMessage } from "@/components/form-message";
import { Input, Select } from "@/components/input";
import { SectionTitle } from "@/components/section-title";
import { SubmitButton } from "@/components/submit-button";
import { STRING_FIELD_MAX_LENGTH } from "@/data/limits";
import { getStringsWithUsage, STRING_TYPES, type TennisString } from "@/data/strings";
import { deleteString, updateString } from "@/strings/actions";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Strings",
  description: "Edit or delete the strings on the LX Tennis Setups list.",
};

type SearchParams = Pick<PageProps<"/account/strings">, "searchParams">;

// The codes updateString and deleteString redirect with.
const ERRORS: Record<string, string> = {
  invalid: "Brand and name can’t be blank, and the type has to be one from the list.",
  "string-exists": "Another string already has that brand and name (ignoring capitals).",
  "in-use": "That string has been tested in a review, so it can’t be deleted.",
};

const TYPE_LABELS = Object.fromEntries(STRING_TYPES.map(({ value, label }) => [value, label]));

// The list is cached and refreshed on every change, so it's in the static
// shell; only the login check and the result of the last change stream in.
export default async function StringsPage({ searchParams }: PageProps<"/account/strings">) {
  const strings = await getStringsWithUsage();

  return (
    <div className={styles.page}>
      <div>
        <BackLink href="/account">Your account</BackLink>
        <SectionTitle as="h1">Strings</SectionTitle>
        <p className={styles.intro}>
          The list reviewers choose from when adding a setup. A change here shows on every setup
          that uses the string. A string can only be deleted while no setup uses it.
        </p>
      </div>

      <Suspense fallback={null}>
        <Status searchParams={searchParams} strings={strings} />
      </Suspense>

      {strings.length === 0 ? (
        <EmptyState title="No strings yet">
          Add one from the setup form on any racquet&rsquo;s page.
        </EmptyState>
      ) : (
        // Collapsed rows keep a dozen strings to one phone screen; each
        // opens to its edit form, and <details> needs no JavaScript.
        <ul className={styles.list}>
          {strings.map((string) => (
            <li key={string.id}>
              <details className={styles.row}>
                <summary className={styles.summary}>
                  <span className={styles.name}>
                    {string.brand} {string.name}
                  </span>
                  <span className={styles.meta}>
                    {TYPE_LABELS[string.type]}
                    {string.inUse && <span className={styles.inUse}>String tested</span>}
                  </span>
                </summary>
                <StringForm string={string} inUse={string.inUse} />
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StringForm({ string, inUse }: { string: TennisString; inUse: boolean }) {
  const id = (field: string) => `string-${string.id}-${field}`;

  return (
    <>
      <form action={updateString} className={styles.form}>
        <input type="hidden" name="id" value={string.id} />
        <Field label="Brand" htmlFor={id("brand")}>
          <Input
            id={id("brand")}
            name="brand"
            defaultValue={string.brand}
            required
            maxLength={STRING_FIELD_MAX_LENGTH}
            autoComplete="off"
          />
        </Field>
        <Field label="Name" htmlFor={id("name")}>
          <Input
            id={id("name")}
            name="name"
            defaultValue={string.name}
            required
            maxLength={STRING_FIELD_MAX_LENGTH}
            autoComplete="off"
          />
        </Field>
        <Field label="Type" htmlFor={id("type")}>
          <Select id={id("type")} name="type" defaultValue={string.type} required>
            {STRING_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <div className={styles.actions}>
          <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
          {/* Delete submits its own form (below) through the `form`
              attribute, so it sits beside Save without sending the edit
              fields, and Save's pending label doesn't react to it. A string
              in use shows Delete as unavailable, with the reason; the
              server refuses it anyway. */}
          {inUse ? (
            <>
              <Button type="button" disabled aria-describedby={id("in-use")}>
                Delete
              </Button>
              <p id={id("in-use")} className={styles.note}>
                Tested in a review, so it can&rsquo;t be deleted.
              </p>
            </>
          ) : (
            <Button type="submit" form={id("delete")}>
              Delete
            </Button>
          )}
        </div>
      </form>
      {!inUse && (
        <form id={id("delete")} action={deleteString} hidden>
          <input type="hidden" name="id" value={string.id} />
        </form>
      )}
    </>
  );
}

// The page's own login check (the proxy's is only the quick one), and the
// result of the last save or delete.
async function Status({
  searchParams,
  strings,
}: SearchParams & { strings: readonly TennisString[] }) {
  const reviewer = await getCurrentReviewer();
  if (!reviewer) redirect(loginPath("/account/strings"));

  const { saved, deleted, error } = await searchParams;
  // A fresh key per response, so the same message twice is focused again.
  const key = crypto.randomUUID();

  if (typeof error === "string" && Object.hasOwn(ERRORS, error)) {
    return (
      <FormMessage key={key} tone="error">
        {ERRORS[error]} Nothing was changed.
      </FormMessage>
    );
  }
  if (deleted === "1") {
    return (
      <FormMessage key={key} tone="success">
        String deleted.
      </FormMessage>
    );
  }
  const savedString = strings.find((string) => String(string.id) === saved);
  if (savedString) {
    return (
      <FormMessage key={key} tone="success">
        Saved {savedString.brand} {savedString.name}.
      </FormMessage>
    );
  }
  return null;
}
