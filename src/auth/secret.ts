import "server-only";
import { createHmac } from "node:crypto";

/**
 * The one place `SESSION_SECRET` is read, and the one place its HMACs are
 * made. Shared so the session cookie and the failed-attempt keys can never
 * be turned into each other: the purpose is part of what's signed, so a
 * signature made for one is meaningless for the other.
 */

/** What an HMAC is for. Adding one must not reuse another's string. */
export type SecretPurpose = "session" | "password" | "attempt";

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  // 32 characters of random base64 is 192+ bits: too long to brute-force the HMAC.
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters. See README (Environment).");
  }
  return secret;
}

export function secretHmac(purpose: SecretPurpose, value: string): string {
  return createHmac("sha256", sessionSecret()).update(`${purpose}:${value}`).digest("base64url");
}
