/**
 * Length caps on free text. Server Actions are public POST endpoints, so the
 * server refuses anything longer; forms set the same `maxLength` so the
 * browser stops it first. Pure (no `server-only`) so any component can use
 * them.
 */

/** A written review. Several long paragraphs. */
export const REVIEW_BODY_MAX_LENGTH = 4000;

/** A string's brand or name. Real ones are well under 30 characters. */
export const STRING_FIELD_MAX_LENGTH = 100;
