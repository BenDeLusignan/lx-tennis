import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Stateless session: an HMAC-signed cookie holding the reviewer id, an
 * expiry and a fingerprint of their password hash. Signed, not encrypted:
 * the contents aren't secret, they just can't be altered without
 * SESSION_SECRET.
 *
 * The password fingerprint is what makes `npm run db:set-password` log that
 * reviewer out everywhere: once the hash changes, old cookies stop matching.
 * Rotating SESSION_SECRET logs everyone out.
 */

const COOKIE_NAME = "lx_session";
const SESSION_DAYS = 30;
const SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60;

export interface SessionPayload {
  /** Reviewer id. */
  sub: number;
  /** Expiry, Unix seconds. Checked on every read; the cookie's Max-Age is only a hint to the browser. */
  exp: number;
  /** `passwordFingerprint` of the reviewer's hash when the session started. */
  pwd: string;
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  // 32 characters of random base64 is 192+ bits: too long to brute-force the HMAC.
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters. See README (Environment).");
  }
  return secret;
}

// The purpose prefix keeps the two HMAC uses apart, so a signature can
// never be passed off as a fingerprint or the other way round.
function hmac(purpose: "session" | "password", value: string): string {
  return createHmac("sha256", sessionSecret()).update(`${purpose}:${value}`).digest("base64url");
}

export function passwordFingerprint(passwordHash: string): string {
  return hmac("password", passwordHash);
}

export function signSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac("session", body)}`;
}

/** The payload if the token is authentic and unexpired, otherwise null. */
export function verifySession(token: string, nowSeconds = Date.now() / 1000): SessionPayload | null {
  const [body, signature, ...rest] = token.split(".");
  if (!body || !signature || rest.length > 0) return null;

  const expected = Buffer.from(hmac("session", body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  // The signature proves we wrote this body, so a parse failure or a wrong
  // shape means a SESSION_SECRET mix-up or an old format: treat as logged out.
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload !== "object" || payload === null) return null;
  const { sub, exp, pwd } = payload as Record<string, unknown>;
  if (typeof sub !== "number" || !Number.isSafeInteger(sub)) return null;
  if (typeof exp !== "number" || typeof pwd !== "string") return null;
  return exp > nowSeconds ? { sub, exp, pwd } : null;
}

/** Only from a Server Action or Route Handler: cookies can't be set while rendering. */
export async function startSession(reviewer: { id: number; passwordHash: string }): Promise<void> {
  const token = signSession({
    sub: reviewer.id,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    pwd: passwordFingerprint(reviewer.passwordHash),
  });
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    // Browsers accept Secure cookies on http://localhost, so this only
    // matters for a hosted production site, where it keeps the cookie off
    // plain HTTP.
    secure: process.env.NODE_ENV === "production",
    // Lax: sent when following a link to the site, not on cross-site POSTs.
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

/** Only from a Server Action or Route Handler. */
export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

/** The current request's verified session, or null. Reading it makes the caller request-time. */
export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return token ? verifySession(token) : null;
}
