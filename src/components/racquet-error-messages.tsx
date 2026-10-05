import Link from "next/link";
import type { ReactNode } from "react";
import {
  IMAGE_MAX_BYTES,
  RACQUET_LIMITS,
  RACQUETS_ADMIN_PATH,
  type RacquetErrorFlag,
} from "@/racquets/racquet-form";

const { year, headSize, weightGrams, balanceMm, lengthIn, stringPattern } = RACQUET_LIMITS;
const imageMegabytes = IMAGE_MAX_BYTES / 1_000_000;

/**
 * One message per `?error=` flag the racquet Server Actions redirect with,
 * shared by the add, edit and list pages so the same flag always reads the
 * same. `Record<RacquetErrorFlag, …>` makes a flag added in racquet-form.ts a
 * type error here until it has its words. Each says what to fix; the page
 * adds what happened to the form ("Nothing was saved…"), which differs
 * between adding (the form comes back empty) and editing (it comes back as
 * the racquet was).
 */
export const RACQUET_ERROR_MESSAGES: Record<RacquetErrorFlag, ReactNode> = {
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
  "image-fetch":
    "The site couldn't get an image from that link. It may have moved, be blocked, or be a link to a page rather than to the image itself. Copy the image address instead, or upload the file.",
  "image-type":
    "That file or link didn't give a photo the site can use. It has to be a JPEG, PNG, WebP, GIF or AVIF showing the whole racquet; a blank or very small picture can't be used.",
  "image-size": `That photo is too big, whether uploaded or linked. The limit is ${imageMegabytes} MB, so use a smaller one.`,
  exists: (
    <>
      A racquet with that brand, model and year is already on the site. Look for it under{" "}
      <Link href="/racquets">Racquets</Link>.
    </>
  ),
  "in-use": "That racquet has been tested in a review, so it can’t be deleted.",
  "not-found": (
    <>
      That racquet isn&rsquo;t on the site any more (it may have just been deleted). The{" "}
      <Link href={RACQUETS_ADMIN_PATH}>racquet list</Link> is up to date.
    </>
  ),
  storage:
    "The photo couldn't be stored just now. Try again in a moment, and let Ben know if it keeps happening.",
};
