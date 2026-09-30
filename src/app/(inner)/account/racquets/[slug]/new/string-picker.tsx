import { Field } from "@/components/field";
import { Input, Select } from "@/components/input";
import { STRING_FIELD_MAX_LENGTH } from "@/data/limits";
import { STRING_TYPES, type TennisString } from "@/data/strings";
import { stringKey } from "./string-key";
import styles from "./page.module.css";

interface StringPickerProps {
  side: "mains" | "crosses";
  strings: readonly TennisString[];
  /**
   * The crosses picker is only shown for a hybrid, so it's only required
   * while it's shown (SetupFormConstraints). The mains picker always is.
   */
  alwaysShown: boolean;
}

const TYPE_LABELS = Object.fromEntries(STRING_TYPES.map(({ value, label }) => [value, label]));

/**
 * One side's string: a choice from the shared list, grouped by brand, or
 * "Add new string…", which reveals brand, name and type fields (Product
 * rule 14). The reveal is CSS (`.side:has(option[value="new"]:checked)` in
 * page.module.css), so it works before JavaScript loads. Field names are
 * the ones createSetupWithReview reads: `<side>String`, `<side>NewBrand`,
 * `<side>NewName`, `<side>NewType`.
 */
export function StringPicker({ side, strings, alwaysShown }: StringPickerProps) {
  // In the list's own order (brand, then name). Not Map.groupBy: the site
  // still supports Node 20, which doesn't have it.
  const brands = new Map<string, TennisString[]>();
  for (const string of strings) {
    brands.set(string.brand, [...(brands.get(string.brand) ?? []), string]);
  }
  const id = (field: string) => `${side}${field}`;

  return (
    <>
      <Field label="String" htmlFor={id("String")}>
        <Select
          id={id("String")}
          name={id("String")}
          required={alwaysShown}
          data-required-when-shown={alwaysShown ? undefined : ""}
          defaultValue=""
        >
          <option value="" disabled>
            Choose a string
          </option>
          {Array.from(brands, ([brand, brandStrings]) => (
            <optgroup key={brand} label={brand}>
              {brandStrings.map((string) => (
                <option
                  key={string.id}
                  value={string.id}
                  data-key={stringKey(string.brand, string.name)}
                >
                  {string.brand} {string.name} ({TYPE_LABELS[string.type]})
                </option>
              ))}
            </optgroup>
          ))}
          <option value="new">Add new string…</option>
        </Select>
      </Field>

      <fieldset className={styles.newString}>
        <legend className={styles.newStringLegend}>New string</legend>
        <p className={styles.hint}>It&rsquo;s added to the list for everyone.</p>
        <Field label="Brand" htmlFor={id("NewBrand")}>
          <Input
            id={id("NewBrand")}
            name={id("NewBrand")}
            maxLength={STRING_FIELD_MAX_LENGTH}
            autoComplete="off"
            data-required-when-shown=""
          />
        </Field>
        <Field label="Name" htmlFor={id("NewName")}>
          <Input
            id={id("NewName")}
            name={id("NewName")}
            maxLength={STRING_FIELD_MAX_LENGTH}
            autoComplete="off"
            data-required-when-shown=""
          />
        </Field>
        <Field label="Type" htmlFor={id("NewType")}>
          <Select id={id("NewType")} name={id("NewType")} defaultValue="" data-required-when-shown="">
            <option value="" disabled>
              Choose a type
            </option>
            {STRING_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>
    </>
  );
}
