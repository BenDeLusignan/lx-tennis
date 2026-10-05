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

/**
 * A racquet's URL slug. The add-a-racquet form refuses a longer one, and the
 * "add a setup" form (`parseRacquetSlug`) accepts no longer one, so a racquet
 * that saved can always be reviewed.
 */
export const RACQUET_SLUG_MAX_LENGTH = 100;

/** A reviewer's password: the floor shared by the script and the change-password form. */
export const PASSWORD_MIN_LENGTH = 12;

/**
 * Server Actions are public POST endpoints, so this bounds what anyone can
 * make scrypt chew on. The same cap the login action applies.
 */
export const PASSWORD_MAX_LENGTH = 1024;

/** A reviewer's email address; 254 is the practical RFC 5321 limit. */
export const EMAIL_MAX_LENGTH = 254;

// The failed-attempt limiter (see `src/data/attempt-rules.ts` for the rules
// and `src/data/attempts.ts` for the storage). Vercel's serverless functions
// share no memory, so failures are counted in the database.

/**
 * Failures against one (typed email, IP) pair before a lockout: 5 wrong
 * passwords from one address for one account. Keyed per address as well as
 * per account so a stranger who doesn't know a reviewer's email can't lock
 * that reviewer out from their own address.
 */
export const LOGIN_FAILURE_LIMIT = 5;

/**
 * Failures from one IP across every email typed before a lockout: higher, so
 * it stops one address spraying many accounts without tripping on a
 * household or an office that shares an address.
 */
export const IP_FAILURE_LIMIT = 20;

/**
 * How long failures keep counting towards the limit. A streak that goes
 * quiet for this long starts again from zero. Longer than the longest
 * lockout step, so the step a repeat offender reaches survives their own
 * lockout (see the escalation below).
 */
export const FAILURE_WINDOW_MINUTES = 30;

/**
 * Lockout lengths, in order, for each lockout a key reaches within one
 * window: the first is a minute, then five, then fifteen for every one
 * after. Short steps on purpose, so a lockout costs the person it happened
 * to very little; the point is to make guessing slow, not to punish.
 */
export const LOCKOUT_STEPS_MINUTES = [1, 5, 15] as const;
