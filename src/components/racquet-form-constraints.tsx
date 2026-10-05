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
 * - Photo: a file or a link, one of the two. Neither input is `required`
 *   (that would announce both as required and send the first complaint to
 *   the file field, even for someone pasting a link), so when neither is
 *   given the file input carries the message "Upload a file or paste an
 *   image link." Both at once is refused, and a file over the upload limit
 *   is refused with a message that says so. (A linked image's size can only
 *   be checked by the server, which fetches it.) With `photoRequired` off
 *   (editing a racquet: no photo means keep the current one) the "neither"
 *   message is dropped and the rest stays.
 * - String pattern: mains and crosses are both required once either is filled.
 * - Year: capped at next year, by the same UTC-year rule as the server
 *   (`maxRacquetYear`). Not in the HTML, so the prerendered page doesn't
 *   freeze a year in.
 *
 * The string pattern's fields are found by the `data-pattern` marker the page
 * puts on them; the year and the photo's two inputs by their form field names.
 */
export function RacquetFormConstraints({ photoRequired }: { photoRequired: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;

    function sync(form: HTMLFormElement) {
      const pattern = Array.from(form.querySelectorAll<HTMLInputElement>("[data-pattern]"));
      const eitherGiven = pattern.some((field) => field.value.trim() !== "");
      for (const field of pattern) field.required = eitherGiven;

      const year = form.elements.namedItem(RACQUET_FIELDS.year);
      if (year instanceof HTMLInputElement) year.max = String(maxRacquetYear());

      const image = form.elements.namedItem(RACQUET_FIELDS.image);
      const imageUrl = form.elements.namedItem(RACQUET_FIELDS.imageUrl);
      if (!(image instanceof HTMLInputElement) || !(imageUrl instanceof HTMLInputElement)) return;

      // The photo is a file or a link. Messages are re-set on every sync, with
      // "" when nothing is wrong, so a fixed mistake stops blocking the submit.
      // A 0-byte file counts as no file, as it does on the server (submit.ts).
      // "Both" goes on the link (the field the reviewer can clear by typing;
      // the file has its own "Remove the chosen file" button). "Neither" and
      // "too big" go on the file input, the first field of the group.
      const picked = image.files?.[0];
      const file = picked && picked.size > 0 ? picked : null;
      const hasLink = imageUrl.value.trim() !== "";
      imageUrl.setCustomValidity(
        file && hasLink
          ? "Use a file or a link, not both: clear this link, or remove the chosen file."
          : "",
      );
      let imageMessage = "";
      if (file && file.size > IMAGE_MAX_BYTES) {
        imageMessage = `That photo is ${(file.size / 1_000_000).toFixed(1)} MB. The limit is ${IMAGE_MAX_BYTES / 1_000_000} MB: choose a smaller one.`;
      } else if (photoRequired && !file && !hasLink) {
        imageMessage = "Upload a file or paste an image link.";
      }
      image.setCustomValidity(imageMessage);
    }

    const onChange = () => sync(form);
    onChange();
    form.addEventListener("input", onChange);
    form.addEventListener("change", onChange);
    return () => {
      form.removeEventListener("input", onChange);
      form.removeEventListener("change", onChange);
    };
  }, [photoRequired]);

  return <span ref={ref} hidden />;
}
