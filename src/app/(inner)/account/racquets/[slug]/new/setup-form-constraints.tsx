"use client";

import { useEffect, useRef } from "react";
import { TENSION_LIMITS } from "@/data/units";
import { stringKey } from "./string-key";

/**
 * Keeps the browser's own form checks in step with what the setup form
 * shows, once JavaScript has loaded. It renders nothing; it works on the
 * form it sits in.
 *
 * - `required` on the fields CSS reveals (a hybrid's crosses string and
 *   gauge, a new string's brand, name and type) follows whether they're
 *   visible. CSS stays the one place that decides what's shown, so the
 *   reveals work before JavaScript loads; a field that's `required` while
 *   hidden would block the form with an error nobody can see, so without
 *   JavaScript those fields aren't required and the server checks them.
 * - Each tension's min and max follow the lb/kg choice (Product rule 6).
 *   Without JavaScript they allow either unit's range, 13.6–80.
 * - The date strung can't be in the future (by the reviewer's own clock).
 * - A new string whose brand and name are already on the list (ignoring
 *   capitals, as the database does) is caught here instead of after a
 *   submit that empties the form.
 */
export function SetupFormConstraints() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;

    const strungOn = form.elements.namedItem("strungOn");
    if (strungOn instanceof HTMLInputElement) strungOn.max = localToday();

    function sync(form: HTMLFormElement) {
      for (const field of form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "[data-required-when-shown]",
      )) {
        field.required = field.getClientRects().length > 0;
      }

      const unit = (form.elements.namedItem("tensionUnit") as RadioNodeList | null)?.value;
      if (unit === "lb" || unit === "kg") {
        const { min, max } = TENSION_LIMITS[unit];
        for (const input of form.querySelectorAll<HTMLInputElement>("[data-tension]")) {
          input.min = String(min);
          input.max = String(max);
        }
      }

      for (const side of ["mains", "crosses"]) {
        const select = form.elements.namedItem(`${side}String`);
        const brand = form.elements.namedItem(`${side}NewBrand`);
        const name = form.elements.namedItem(`${side}NewName`);
        if (
          !(select instanceof HTMLSelectElement) ||
          !(brand instanceof HTMLInputElement) ||
          !(name instanceof HTMLInputElement)
        ) {
          continue;
        }
        // Only while the field is shown: a hidden field's message can't be
        // seen or focused, so it would block the submit silently (for
        // instance after switching a hybrid back to a full bed). Every
        // change, including that switch, runs this again.
        const shown = name.getClientRects().length > 0;
        const key = stringKey(brand.value, name.value);
        const existing =
          shown && select.value === "new"
            ? Array.from(select.options).find((option) => option.dataset.key === key)
            : undefined;
        name.setCustomValidity(
          existing
            ? `${brand.value.trim()} ${name.value.trim()} is already on the list. Choose it under “String” instead.`
            : "",
        );
      }
    }

    const onChange = () => sync(form);
    onChange();
    form.addEventListener("input", onChange);
    form.addEventListener("change", onChange);
    return () => {
      form.removeEventListener("input", onChange);
      form.removeEventListener("change", onChange);
    };
  }, []);

  return <span ref={ref} hidden />;
}

/** Today as YYYY-MM-DD in the reviewer's time zone, the format a date input's `max` takes. */
function localToday(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
