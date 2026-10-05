"use client";

import { useEffect, useRef } from "react";
import {
  IMAGE_MAX_BYTES,
  RACQUET_FIELDS,
  maxRacquetYear,
} from "@/racquets/racquet-form";

/**
 * Keeps the browser's own form checks in step with the server's rules, once
 * JavaScript has loaded. It renders nothing; it works on the form it sits in.
 *
 * Why it matters more here than on other forms: a refused save reloads the
 * page, which empties every field *and* forgets the chosen photo, so each
 * mistake caught before the submit saves the reviewer a re-pick on a phone.
 * Without JavaScript none of this runs and the server's checks catch the same
 * mistakes (the page's messages explain each).
 *
 * - Source link: required as soon as any spec has a value (Product rule 10).
 * - String pattern: mains and crosses are both required once either is filled.
 * - Photo: a file over the upload limit is refused with a message that says so.
 * - Year: capped at next year, by the same UTC-year rule as the server
 *   (`maxRacquetYear`). Not in the HTML, so the prerendered page doesn't
 *   freeze a year in.
 *
 * The fields are found by `data-*` markers that the page puts on them, so
 * this file doesn't need to know which specs there are.
 */
export function RacquetFormConstraints() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;

    function sync(form: HTMLFormElement) {
      const specs = Array.from(form.querySelectorAll<HTMLInputElement>("[data-spec]"));
      const source = form.elements.namedItem(RACQUET_FIELDS.sourceUrl);
      if (source instanceof HTMLInputElement) source.required = specs.some((field) => field.value.trim() !== "");

      const pattern = Array.from(form.querySelectorAll<HTMLInputElement>("[data-pattern]"));
      const eitherGiven = pattern.some((field) => field.value.trim() !== "");
      for (const field of pattern) field.required = eitherGiven;

      const year = form.elements.namedItem(RACQUET_FIELDS.year);
      if (year instanceof HTMLInputElement) year.max = String(maxRacquetYear());

      const image = form.elements.namedItem(RACQUET_FIELDS.image);
      if (image instanceof HTMLInputElement) {
        const file = image.files?.[0];
        image.setCustomValidity(
          file && file.size > IMAGE_MAX_BYTES
            ? `That photo is ${(file.size / 1_000_000).toFixed(1)} MB. The limit is ${IMAGE_MAX_BYTES / 1_000_000} MB: choose a smaller one.`
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
