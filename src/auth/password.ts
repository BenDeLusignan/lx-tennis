import "server-only";
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with scrypt (memory-hard, built into Node, no native
 * dependency). Each hash stores its own parameters and salt,
 * `scrypt$N$r$p$salt$hash`, so the cost can be raised later without
 * invalidating existing passwords.
 */

// N = 2^15, r = 8: about 32 MiB and tens of milliseconds per hash, which is
// slow enough to make guessing a leaked hash expensive and fast enough for a
// login. scrypt needs 128 * N * r bytes, above Node's 32 MiB default maxmem.
const COST = { N: 2 ** 15, r: 8, p: 1 } as const;
const MAX_MEMORY = 64 * 1024 * 1024;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  // Executor form rather than Promise.withResolvers, which Node 20 (still
  // supported by Next 16) doesn't have; crypto.scrypt has no promise API.
  return new Promise((resolve, reject) => {
    // NFC so the same password typed on a Mac and on a phone (which can
    // compose accented letters differently) produces the same bytes.
    scrypt(password.normalize("NFC"), salt, KEY_BYTES, { ...options, maxmem: MAX_MEMORY }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, COST);
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

// Hashed once, then used when there's no real hash to check against, so a
// login attempt takes the same time whether or not the username exists.
let dummyHash: Promise<string> | undefined;

/**
 * Constant-time check of `password` against a stored hash. A null or
 * malformed hash still costs one full scrypt run and returns false.
 */
export async function verifyPassword(password: string, storedHash: string | null): Promise<boolean> {
  dummyHash ??= hashPassword(randomBytes(SALT_BYTES).toString("base64url"));
  const hash = storedHash ?? (await dummyHash);

  const [scheme, N, r, p, salt, key] = hash.split("$");
  const params = { N: Number(N), r: Number(r), p: Number(p) };
  const valid =
    scheme === "scrypt" &&
    Object.values(params).every(Number.isSafeInteger) &&
    salt !== undefined &&
    key !== undefined;
  const expected = valid ? Buffer.from(key, "base64url") : Buffer.alloc(KEY_BYTES);

  const actual = await derive(
    password,
    valid ? Buffer.from(salt, "base64url") : Buffer.alloc(SALT_BYTES),
    valid ? params : COST,
  );
  return storedHash !== null && valid && expected.length === actual.length && timingSafeEqual(expected, actual);
}
