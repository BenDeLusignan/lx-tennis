import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { getCurrentReviewer } from "@/auth/current-reviewer";
import { loginPath } from "@/auth/safe-next-path";
import { BackLink } from "@/components/back-link";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { FormActions } from "@/components/form-actions";
import { FormMessage } from "@/components/form-message";
import { Input, Select } from "@/components/input";
import { Panel } from "@/components/panel";
import { SectionTitle } from "@/components/section-title";
import { SubmitButton } from "@/components/submit-button";
import { BRANDS, IMAGE_SIZE } from "@/data/racquets";
import { addRacquet } from "@/racquets/actions";
import {
  IMAGE_ACCEPT,
  IMAGE_MAX_BYTES,
  NEW_RACQUET_PATH,
  RACQUET_ERROR_FLAGS,
  RACQUET_FIELDS,
  RACQUET_LIMITS,
  type RacquetErrorFlag,
} from "@/racquets/racquet-form";
import { ClearFileButton } from "./clear-file-button";
import { RacquetFormConstraints } from "./racquet-form-constraints";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Add a racquet",
};

const { year, headSize, weightGrams, balanceMm, lengthIn, stringPattern } = RACQUET_LIMITS;
const imageMegabytes = IMAGE_MAX_BYTES / 1_000_000;

// Browser-side twins of the server's checks, so a mistake is caught before a
// submit empties the form and the photo (the server stays the authority, see
// parseFields and the image-link check in submit.ts). A `pattern` must match
// the whole value. Model: at least one non-space character. Image link: https
// (any letter case, as the server's URL parsing allows), then a host (no / ? #
// @ or : in it, so no user:password and no port) that contains a dot, then
// anything but spaces; this refuses https://localhost, which type="url" alone
// lets through (as it does http://). The server also refuses a port, except the
// default :443 that it quietly drops; the client simply refuses every port.
const MODEL_PATTERN = ".*\\S.*";
const HTTPS_PATTERN = "[Hh][Tt][Tt][Pp][Ss]://[^\\s\\/?#@:]+\\.[^\\s\\/?#@:]+(?:[\\/?#]\\S*)?";

// One message per flag the action redirects with. `Record<RacquetErrorFlag, …>`
// makes a flag added in racquet-form.ts a type error here until it has its
// words. Each says what to fix; FormStatus adds that nothing was saved.
const ERRORS: Record<RacquetErrorFlag, ReactNode> = {
  invalid: "Something in the form was missing or not in the right format.",
  brand: "Choose one of the brands in the list.",
  model: `Enter the model without the brand (for example EZONE 98), up to ${RACQUET_LIMITS.model.maxLength} characters.`,
  year: `The model year must be a whole year from ${year.min} to next year.`,
  "head-size": `Head size must be a whole number of square inches, ${headSize.min}–${headSize.max}.`,
  weight: `Unstrung weight must be a whole number of grams, ${weightGrams.min}–${weightGrams.max}. Leave it empty if the manufacturer doesn't publish it.`,
  balance: `Balance must be a whole number of millimetres, ${balanceMm.min}–${balanceMm.max}.`,
  length: `Length must be ${lengthIn.min}–${lengthIn.max} inches, with at most two decimal places.`,
  "string-pattern": `Enter both the mains and the crosses (each ${stringPattern.min}–${stringPattern.max}), or leave both empty.`,
  "image-missing": "The photo is required: upload a file or paste an image link.",
  "image-both": "You gave both a photo file and an image link. Use one or the other, not both.",
  "image-link": `That image link can't be used. It must be a complete address starting with https://, up to ${RACQUET_LIMITS.imageUrl.maxLength} characters, with no username, password or port.`,
  "image-fetch": "The site couldn't get an image from that link. It may have moved, be blocked, or be a link to a page rather than to the image itself. Copy the image address instead, or upload the file.",
  "image-type": "That file or link didn't give a photo the site can read. Use a JPEG, PNG, WebP, GIF or AVIF.",
  "image-size": `That photo is too big, whether uploaded or linked. The limit is ${imageMegabytes} MB, so use a smaller one.`,
  exists: (
    <>
      A racquet with that brand, model and year is already on the site. Look for it under{" "}
      <Link href="/racquets">Racquets</Link>.
    </>
  ),
  storage:
    "The photo couldn't be stored just now. Try again in a moment, and let Ben know if it keeps happening.",
};

export default function NewRacquetPage({ searchParams }: PageProps<"/account/racquets/new">) {
  return (
    <div className={styles.page}>
      <div>
        <BackLink href="/racquets">All racquets</BackLink>
        <SectionTitle as="h1">Add a racquet</SectionTitle>
        <p className={styles.lede}>
          Add a racquet that&rsquo;s missing from the list, so setups and reviews can be entered for
          it. The photo is required.
        </p>
      </div>

      <Panel aria-labelledby="form-heading">
        <SectionTitle id="form-heading" size="lg">
          Racquet details
        </SectionTitle>

        {/* React gives a form with a Server Action method="post" and enctype="multipart/form-data"
            itself (setting them here only logs a warning). Multipart is what carries the photo,
            and as a plain POST it works before JavaScript loads, like the other forms. */}
        <form action={addRacquet} className={styles.form}>
          <RacquetFormConstraints />

          <Suspense fallback={null}>
            <FormStatus searchParams={searchParams} />
          </Suspense>

          <Field label="Brand" htmlFor={RACQUET_FIELDS.brand}>
            <Select
              id={RACQUET_FIELDS.brand}
              name={RACQUET_FIELDS.brand}
              required
              defaultValue=""
              aria-describedby="brand-hint"
            >
              <option value="" disabled>
                Choose a brand
              </option>
              {BRANDS.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </Select>
            <p id="brand-hint" className={styles.hint}>
              Only these brands for now.
            </p>
          </Field>

          <Field label="Model" htmlFor={RACQUET_FIELDS.model}>
            <Input
              id={RACQUET_FIELDS.model}
              name={RACQUET_FIELDS.model}
              type="text"
              required
              maxLength={RACQUET_LIMITS.model.maxLength}
              pattern={MODEL_PATTERN}
              title="The model, without the brand"
              autoComplete="off"
              aria-describedby="model-hint"
            />
            <p id="model-hint" className={styles.hint}>
              The model without the brand, e.g. EZONE 98.
            </p>
          </Field>

          <Field label="Model year" htmlFor={RACQUET_FIELDS.year}>
            <Input
              id={RACQUET_FIELDS.year}
              name={RACQUET_FIELDS.year}
              type="number"
              inputMode="numeric"
              required
              min={year.min}
              step={year.step}
              aria-describedby="year-hint"
            />
            <p id="year-hint" className={styles.hint}>
              The year this version came out, e.g. 2023. It tells apart two versions of one model.
            </p>
          </Field>

          {/* The photo is one required thing with two ways in. Neither input can
              be `required` (each is only needed while the other is empty, and a
              `required` pair would send a reviewer who wants to paste a link to
              the file field first, and be announced as two required fields). So
              RacquetFormConstraints puts a custom validity on the file input when
              neither is given, and the server's `image-missing` / `image-both`
              catch it before JavaScript has loaded. */}
          <fieldset className={`${styles.group} ${styles.box}`} aria-describedby="photo-hint">
            <legend className={`${styles.legend} ${styles.boxLegend}`}>
              Photo <span className={styles.qualifier}>(required)</span>
            </legend>
            <p id="photo-hint" className={styles.hint}>
              Give the photo <strong>one way: upload a file, or paste an image link. Not both.</strong>{" "}
              Either way it should be the manufacturer&rsquo;s official photo, face-on, with the whole
              frame in view: JPEG, PNG, WebP, GIF or AVIF, up to {imageMegabytes} MB. It&rsquo;s scaled to
              fit a {IMAGE_SIZE.width} × {IMAGE_SIZE.height} picture, centred at the top. The
              background isn&rsquo;t removed, so a photo with a transparent one looks best.
            </p>

            <Field label="Upload a file" htmlFor={RACQUET_FIELDS.image}>
              <Input
                id={RACQUET_FIELDS.image}
                name={RACQUET_FIELDS.image}
                type="file"
                accept={IMAGE_ACCEPT}
                className={styles.file}
                aria-describedby="image-hint"
              />
              <ClearFileButton inputId={RACQUET_FIELDS.image} className={styles.clearFile} />
              <p id="image-hint" className={styles.hint}>
                A photo straight from a phone camera is often bigger than {imageMegabytes} MB, so shrink
                it first.
              </p>
            </Field>

            {/* The legend's hint already says "one way … not both" to a screen reader. */}
            <p className={styles.or} aria-hidden="true">
              or
            </p>

            <Field label="Paste an image link" htmlFor={RACQUET_FIELDS.imageUrl}>
              <Input
                id={RACQUET_FIELDS.imageUrl}
                name={RACQUET_FIELDS.imageUrl}
                type="url"
                inputMode="url"
                maxLength={RACQUET_LIMITS.imageUrl.maxLength}
                pattern={HTTPS_PATTERN}
                title="A web address starting with https://, with no spaces and no port"
                autoComplete="off"
                aria-describedby="image-url-hint"
              />
              <p id="image-url-hint" className={styles.hint}>
                Must start with https:// and point straight at the image itself, not at a page that
                shows it. On a computer, right-click the photo on the other website and choose
                &ldquo;Copy image address&rdquo;; on a phone, press and hold the photo. LX Tennis
                fetches it once and saves its own copy, so the photo stays even if that website
                removes it. The same {imageMegabytes} MB limit applies.
              </p>
            </Field>
          </fieldset>

          <fieldset className={`${styles.group} ${styles.box}`} aria-describedby="specs-hint">
            <legend className={`${styles.legend} ${styles.boxLegend}`}>
              Official specs <span className={styles.qualifier}>(optional)</span>
            </legend>
            <p id="specs-hint" className={styles.hint}>
              Copy these from the manufacturer&rsquo;s official page, as published. Leave out any it
              doesn&rsquo;t publish: please don&rsquo;t guess or convert.
            </p>

            <div className={styles.specGrid}>
              <SpecField
                label="Head size (sq in)"
                name={RACQUET_FIELDS.headSize}
                limits={headSize}
                hint="Square inches, e.g. 98."
              />
              <SpecField
                label="Unstrung weight (g)"
                name={RACQUET_FIELDS.weightGrams}
                limits={weightGrams}
                hint="Grams, as published, e.g. 305."
              />
              <SpecField
                label="Balance (mm)"
                name={RACQUET_FIELDS.balanceMm}
                limits={balanceMm}
                hint="Millimetres from the butt cap, e.g. 320."
              />
              <SpecField
                label="Length (in)"
                name={RACQUET_FIELDS.lengthIn}
                limits={lengthIn}
                decimal
                hint="Inches, e.g. 27 or 27.25."
              />

              <fieldset className={styles.pattern} aria-describedby="pattern-hint">
                <legend className={styles.legend}>String pattern</legend>
                <div className={styles.patternRow}>
                  <Field label="Mains" htmlFor={RACQUET_FIELDS.stringMains}>
                    <PatternInput name={RACQUET_FIELDS.stringMains} />
                  </Field>
                  <span className={styles.times} aria-hidden="true">
                    ×
                  </span>
                  <Field label="Crosses" htmlFor={RACQUET_FIELDS.stringCrosses}>
                    <PatternInput name={RACQUET_FIELDS.stringCrosses} />
                  </Field>
                </div>
                <p id="pattern-hint" className={styles.hint}>
                  Both numbers or neither, e.g. 16 and 19.
                </p>
              </fieldset>
            </div>
          </fieldset>

          {/* Cancel is only a link back to the list: nothing is saved, and it
              works before JavaScript loads. */}
          <FormActions>
            <SubmitButton pendingLabel="Adding…" fill>
              Add racquet
            </SubmitButton>
            <Button href="/racquets" fill>
              Cancel
            </Button>
          </FormActions>
        </form>
      </Panel>
    </div>
  );
}

interface SpecFieldProps {
  label: string;
  name: string;
  limits: { readonly min: number; readonly max: number; readonly step: number };
  hint: string;
  /** Allows a decimal point (a phone then shows a keypad with one). */
  decimal?: boolean;
}

// An optional number.
function SpecField({ label, name, limits, hint, decimal = false }: SpecFieldProps) {
  return (
    <Field label={label} htmlFor={name}>
      <Input
        id={name}
        name={name}
        type="number"
        inputMode={decimal ? "decimal" : "numeric"}
        min={limits.min}
        max={limits.max}
        step={limits.step}
        aria-describedby={`${name}-hint`}
      />
      <p id={`${name}-hint`} className={styles.hint}>
        {hint}
      </p>
    </Field>
  );
}

// Optional, but only as a pair: RacquetFormConstraints makes both required
// once either has a value.
function PatternInput({ name }: { name: string }) {
  return (
    <Input
      id={name}
      name={name}
      type="number"
      inputMode="numeric"
      min={stringPattern.min}
      max={stringPattern.max}
      step={stringPattern.step}
      data-pattern=""
    />
  );
}

// The page's own login check (the proxy's is only the quick one), and the
// message for the last refused save.
async function FormStatus({ searchParams }: Pick<PageProps<"/account/racquets/new">, "searchParams">) {
  const reviewer = await getCurrentReviewer();
  if (!reviewer) redirect(loginPath(NEW_RACQUET_PATH));

  const { error } = await searchParams;
  // Only the flags the action can send, so `?error=constructor` finds nothing.
  const flag = RACQUET_ERROR_FLAGS.find((known) => known === error);
  if (!flag) return null;
  return (
    <FormMessage key={crypto.randomUUID()} tone="error">
      {ERRORS[flag]} Nothing was saved, so the form is empty again and the photo (or its link)
      needs adding again.
    </FormMessage>
  );
}
