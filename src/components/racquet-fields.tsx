import { ClearFileButton } from "@/components/clear-file-button";
import { Field } from "@/components/field";
import { Input, Select } from "@/components/input";
import { RacquetFormConstraints } from "@/components/racquet-form-constraints";
import { RacquetPhoto } from "@/components/racquet-photo";
import { BRANDS, type Racquet } from "@/data/racquets";
import {
  IMAGE_ACCEPT,
  IMAGE_MAX_BYTES,
  RACQUET_FIELDS,
  RACQUET_LIMITS,
  racquetModel,
} from "@/racquets/racquet-form";
import styles from "./racquet-fields.module.css";

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

interface RacquetFieldsProps {
  /**
   * The racquet being edited: its details prefill the fields, its photo is
   * shown, and the photo becomes optional (leaving it empty keeps it).
   * Leave it out to add a racquet, with empty fields and a required photo.
   */
  racquet?: Racquet;
}

/**
 * The body of the add-a-racquet and edit-a-racquet forms: brand, model, year,
 * the photo and the official specs, plus the browser-side checks that go with
 * them (`RacquetFormConstraints`). One component, so the two forms can't
 * drift: same fields, same limits, same hints. It renders the form's fields
 * as siblings, to sit inside the caller's own `<form>` (which supplies the
 * Server Action, the `?error=` message, the buttons and, for an edit, the
 * hidden `slug`) and its column layout.
 */
export function RacquetFields({ racquet }: RacquetFieldsProps) {
  const editing = racquet !== undefined;
  const specs = racquet?.specs;

  return (
    <>
      <RacquetFormConstraints photoRequired={!editing} />

      <Field label="Brand" htmlFor={RACQUET_FIELDS.brand}>
        <Select
          id={RACQUET_FIELDS.brand}
          name={RACQUET_FIELDS.brand}
          required
          defaultValue={racquet?.brand ?? ""}
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
          defaultValue={racquet && racquetModel(racquet)}
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
          defaultValue={racquet?.year}
          aria-describedby="year-hint"
        />
        <p id="year-hint" className={styles.hint}>
          The year this version came out, e.g. 2023. It tells apart two versions of one model.
        </p>
      </Field>

      {/* The photo is one thing with two ways in, required when adding and
          optional when editing. Neither input can be `required` (each is only
          needed while the other is empty, and a `required` pair would send a
          reviewer who wants to paste a link to the file field first, and be
          announced as two required fields). So RacquetFormConstraints puts a
          custom validity on the file input when adding with neither given,
          and the server's `image-missing` / `image-both` catch it before
          JavaScript has loaded. */}
      <fieldset className={`${styles.group} ${styles.box}`} aria-describedby="photo-hint">
        <legend className={`${styles.legend} ${styles.boxLegend}`}>
          Photo <span className={styles.qualifier}>({editing ? "optional" : "required"})</span>
        </legend>
        {racquet && (
          <div className={styles.current}>
            {/* `sizes` matches `.currentPhoto` in racquet-fields.module.css (a fixed 6rem at every width). */}
            <RacquetPhoto image={racquet.image} sizes="6rem" className={styles.currentPhoto} />
            <p className={styles.hint}>Current photo</p>
          </div>
        )}

        <p id="photo-hint" className={styles.hint}>
          {editing && <>Leave both empty to keep the current photo. To replace it, give the new one </>}
          {!editing && <>Give the photo </>}
          <strong>one way: upload a file, or paste an image link. Not both.</strong> Either way it
          should be the manufacturer&rsquo;s official photo, face-on, with the whole frame in view:
          JPEG, PNG, WebP, GIF or AVIF, up to {imageMegabytes} MB. A plain border is trimmed and the
          racquet is scaled to match the others. This works best on a plain white or transparent
          background; a shadow or pattern behind the racquet makes it come out smaller. The
          background isn&rsquo;t removed.
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
            A photo straight from a phone camera is often bigger than {imageMegabytes} MB, so shrink it
            first.
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
            Must start with https:// and point straight at the image itself, not at a page that shows
            it. On a computer, right-click the photo on the other website and choose &ldquo;Copy image
            address&rdquo;; on a phone, press and hold the photo. LX Tennis fetches it once and saves
            its own copy, so the photo stays even if that website removes it. The same{" "}
            {imageMegabytes} MB limit applies.
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
            defaultValue={specs?.headSizeSqIn}
            hint="Square inches, e.g. 98."
          />
          <SpecField
            label="Unstrung weight (g)"
            name={RACQUET_FIELDS.weightGrams}
            limits={weightGrams}
            defaultValue={specs?.weightGrams}
            hint="Grams, as published, e.g. 305."
          />
          <SpecField
            label="Balance (mm)"
            name={RACQUET_FIELDS.balanceMm}
            limits={balanceMm}
            defaultValue={specs?.balanceMm}
            hint="Millimetres from the butt cap, e.g. 320."
          />
          <SpecField
            label="Length (in)"
            name={RACQUET_FIELDS.lengthIn}
            limits={lengthIn}
            defaultValue={specs?.lengthIn}
            decimal
            hint="Inches, e.g. 27 or 27.25."
          />

          <fieldset className={styles.pattern} aria-describedby="pattern-hint">
            <legend className={styles.legend}>String pattern</legend>
            <div className={styles.patternRow}>
              <Field label="Mains" htmlFor={RACQUET_FIELDS.stringMains}>
                <PatternInput
                  name={RACQUET_FIELDS.stringMains}
                  defaultValue={specs?.stringPattern?.mains}
                />
              </Field>
              <span className={styles.times} aria-hidden="true">
                ×
              </span>
              <Field label="Crosses" htmlFor={RACQUET_FIELDS.stringCrosses}>
                <PatternInput
                  name={RACQUET_FIELDS.stringCrosses}
                  defaultValue={specs?.stringPattern?.crosses}
                />
              </Field>
            </div>
            <p id="pattern-hint" className={styles.hint}>
              Both numbers or neither, e.g. 16 and 19.
            </p>
          </fieldset>
        </div>
      </fieldset>
    </>
  );
}

interface SpecFieldProps {
  label: string;
  name: string;
  limits: { readonly min: number; readonly max: number; readonly step: number };
  hint: string;
  /** The racquet's current value when editing; null (not published) and undefined (adding) both leave it empty. */
  defaultValue?: number | null;
  /** Allows a decimal point (a phone then shows a keypad with one). */
  decimal?: boolean;
}

// An optional number.
function SpecField({ label, name, limits, hint, defaultValue, decimal = false }: SpecFieldProps) {
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
        defaultValue={defaultValue ?? undefined}
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
function PatternInput({ name, defaultValue }: { name: string; defaultValue?: number }) {
  return (
    <Input
      id={name}
      name={name}
      type="number"
      inputMode="numeric"
      min={stringPattern.min}
      max={stringPattern.max}
      step={stringPattern.step}
      defaultValue={defaultValue}
      data-pattern=""
    />
  );
}
