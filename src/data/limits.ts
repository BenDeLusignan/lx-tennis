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

/** A reviewer's password: the floor shared by the script and the change-password form. */
export const PASSWORD_MIN_LENGTH = 12;

/**
 * Server Actions are public POST endpoints, so this bounds what anyone can
 * make scrypt chew on. The same cap the login action applies.
 */
export const PASSWORD_MAX_LENGTH = 1024;

/** A reviewer's email address; 254 is the practical RFC 5321 limit. */
export const EMAIL_MAX_LENGTH = 254;
