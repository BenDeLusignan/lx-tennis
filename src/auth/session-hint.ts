/**
 * A plain, readable cookie that only says "a reviewer was logged in on this
 * browser" (`lx_member=1`). It is a hint for the page's loading screen and
 * nothing else: it carries no identity, grants nothing, and no server check
 * looks at it (`getCurrentReviewer()` is still the only boundary). Set by
 * `startSession`, cleared by `endSession`, and kept honest by the script in
 * `session-gate.tsx` (which corrects it from what the page really shows).
 *
 * No `server-only`: the gate script and `session.ts` both need the name.
 */
export const SESSION_HINT_COOKIE = "lx_member";
