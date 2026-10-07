import "server-only";
import dns from "node:dns/promises";
import https from "node:https";
import net from "node:net";
import { IMAGE_MAX_BYTES, RACQUET_LIMITS, type RacquetErrorFlag } from "@/racquets/racquet-form";

/**
 * Fetches the photo behind an image link a reviewer pasted, so the site can
 * keep its own copy (the same pipeline as an upload; see `submit.ts`).
 *
 * The reviewer decides where the server connects, so this is the textbook
 * server-side request forgery risk: a link to `https://169.254.169.254/...`
 * or to an internal host must never be fetched, and its answer must never
 * come back to anyone. What stops that:
 *
 * - https only, on the default port, with no user name or password in the link.
 * - The host is resolved here, every address must be public (`isPublicAddress`),
 *   and the connection is then made to exactly those vetted addresses: the
 *   request never looks the name up again, so a DNS answer that changes
 *   between the check and the connection (rebinding) can't send it elsewhere.
 *   A host with even one private address among its answers is refused.
 * - The same check on every redirect hop, with the same https-only rule, and
 *   at most `MAX_REDIRECTS` of them.
 * - A connect timeout and a total timeout; the body is read only up to
 *   `IMAGE_MAX_BYTES` and then dropped; no cookies or credentials are sent
 *   and none are kept; the response is never decoded here (`Accept-Encoding:
 *   identity`), so a compressed bomb can't outgrow the byte count.
 * - Every failure to get an answer is the one `image-fetch` flag, so the form
 *   can't be used to tell which internal hosts exist.
 *
 * What came back is only trusted as bytes: whether it is an image is decided
 * by sharp afterwards (`toRacquetWebp`), not by the Content-Type it claims.
 */

export const MAX_REDIRECTS = 3;
const CONNECT_TIMEOUT_MS = 5_000;
const TOTAL_TIMEOUT_MS = 15_000;
const USER_AGENT = "LXTennis-image-fetch/1.0 (+https://lx-tennis.vercel.app/)";
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// --- Which addresses may be connected to ---

/** [first address, prefix length]: IPv4 ranges that are not the public internet. */
const BLOCKED_V4: readonly (readonly [string, number])[] = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, including the cloud metadata address 169.254.169.254
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, and the broadcast address
];

function v4ToNumber(address: string): number {
  return address.split(".").reduce((total, part) => total * 256 + Number(part), 0);
}

function isPublicV4(address: string): boolean {
  const value = v4ToNumber(address);
  return !BLOCKED_V4.some(([base, prefix]) => {
    const size = 2 ** (32 - prefix);
    const start = v4ToNumber(base);
    return value >= start && value < start + size;
  });
}

/** The eight 16-bit groups of an IPv6 address (`::` expanded, an embedded dotted IPv4 tail folded in), or null. */
function ipv6Groups(address: string): number[] | null {
  const zone = address.indexOf("%");
  const text = zone === -1 ? address : address.slice(0, zone);
  let tail: number[] = [];
  let head = text;
  const lastColon = text.lastIndexOf(":");
  const dotted = text.slice(lastColon + 1);
  if (dotted.includes(".")) {
    if (!net.isIPv4(dotted)) return null;
    const value = v4ToNumber(dotted);
    tail = [Math.floor(value / 65536), value % 65536];
    head = text.slice(0, lastColon + 1) + "0:0";
  }
  const halves = head.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string) => (part === "" ? [] : part.split(":").map((group) => Number.parseInt(group, 16)));
  const first = parse(halves[0]);
  const second = halves.length === 2 ? parse(halves[1]) : [];
  const missing = 8 - first.length - second.length;
  if ((halves.length === 2 && missing < 1) || (halves.length === 1 && missing !== 0)) return null;
  const groups = [...first, ...new Array<number>(halves.length === 2 ? missing : 0).fill(0), ...second];
  if (groups.length !== 8 || groups.some((group) => !Number.isInteger(group) || group < 0 || group > 0xffff)) {
    return null;
  }
  if (tail.length) {
    groups[6] = tail[0];
    groups[7] = tail[1];
  }
  return groups;
}

function isPublicV6(address: string): boolean {
  const groups = ipv6Groups(address);
  if (!groups) return false;
  // IPv4 inside IPv6 (::ffff:a.b.c.d, in either spelling): judged as the IPv4 address it is.
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return isPublicV4(`${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`);
  }
  // Only global unicast (2000::/3) can be the public internet. That leaves out
  // ::, ::1, fc00::/7 (unique local), fe80::/10 (link-local) and ff00::/8 (multicast)...
  if ((groups[0] & 0xe000) !== 0x2000) return false;
  // ...and inside it, the ranges that are not for ordinary hosts or that
  // embed an IPv4 address: 2001::/23 (protocol assignments, Teredo),
  // 2001:db8::/32 (documentation), 2002::/16 (6to4) and 3fff::/20 (documentation).
  if (groups[0] === 0x2001 && (groups[1] < 0x200 || groups[1] === 0x0db8)) return false;
  if (groups[0] === 0x2002) return false;
  if (groups[0] === 0x3fff && groups[1] < 0x1000) return false;
  return true;
}

/** Whether a connection to this IP address would leave the server for the public internet. */
export function isPublicAddress(address: string): boolean {
  const bare = address.startsWith("[") && address.endsWith("]") ? address.slice(1, -1) : address;
  if (net.isIPv4(bare)) return isPublicV4(bare);
  if (net.isIPv6(bare)) return isPublicV6(bare);
  return false;
}

// --- Which links may be followed ---

/**
 * An image link as the form takes it: https, the default port, no user name
 * or password, no whitespace or control characters, within the length limit.
 * Null for anything else. (`URL` also folds odd spellings of an address,
 * `https://2130706433/` or `https://0x7f.1/`, into dotted form, which
 * `isPublicAddress` then refuses.)
 */
export function parseImageLink(text: string): URL | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > RACQUET_LIMITS.imageUrl.maxLength || /[\s\u0000-\u001f\u007f]/.test(trimmed)) {
    return null;
  }
  return checkedUrl(() => new URL(trimmed));
}

function checkedUrl(make: () => URL): URL | null {
  try {
    const url = make();
    const ok = url.protocol === "https:" && url.hostname !== "" && !url.username && !url.password && url.port === "";
    return ok ? url : null;
  } catch {
    return null;
  }
}

// --- The two things that touch the network, replaceable in tests ---

export interface ImageResponse {
  status: number;
  /** The `Location` header, if any. */
  location: string | null;
  /** The `Content-Length` header as a number, if present and valid. */
  contentLength: number | null;
  /** True when the body is not sent as-is (a `Content-Encoding` other than identity). */
  encoded: boolean;
  body: AsyncIterable<Uint8Array>;
  /** Drops the connection. Safe to call more than once. */
  close(): void;
}

export interface ImageFetchDeps {
  /** Every address the host name resolves to. */
  resolve(hostname: string, signal: AbortSignal): Promise<string[]>;
  /** GET `url`, connecting only to `addresses`, which have already been vetted. */
  request(url: URL, addresses: string[], signal: AbortSignal): Promise<ImageResponse>;
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

const defaultResolve: ImageFetchDeps["resolve"] = async (hostname, signal) => {
  const answers = await abortable(dns.lookup(hostname, { all: true, verbatim: true }), signal);
  return answers.map((answer) => answer.address);
};

const defaultRequest: ImageFetchDeps["request"] = (url, addresses, signal) =>
  new Promise<ImageResponse>((resolve, reject) => {
    const request = https.request(url, {
      method: "GET",
      // A fresh connection every time, never a shared pool: nothing from one
      // reviewer's fetch can be reused by another's.
      agent: false,
      signal,
      maxHeaderSize: 16_384,
      // No Cookie, Authorization or Referer: nothing of ours goes along.
      headers: {
        "user-agent": USER_AGENT,
        accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8",
        "accept-encoding": "identity",
      },
      // The only name lookup: it answers with the addresses already vetted.
      lookup: (_hostname, options, callback) => {
        const answers = addresses.map((address) => ({ address, family: net.isIPv6(address) ? 6 : 4 }));
        if (options.all) (callback as (error: null, all: typeof answers) => void)(null, answers);
        else callback(null, answers[0].address, answers[0].family);
      },
    });

    request.on("socket", (socket) => {
      if (!socket.connecting) return;
      const timer = setTimeout(() => request.destroy(new Error("connect timeout")), CONNECT_TIMEOUT_MS);
      socket.once("secureConnect", () => clearTimeout(timer));
      socket.once("close", () => clearTimeout(timer));
    });
    request.on("error", reject);
    request.on("response", (response) => {
      const header = (name: string) => {
        const value = response.headers[name];
        return typeof value === "string" ? value : null;
      };
      const length = header("content-length");
      const encoding = header("content-encoding")?.trim().toLowerCase();
      resolve({
        status: response.statusCode ?? 0,
        location: header("location"),
        contentLength: length !== null && /^\d{1,15}$/.test(length.trim()) ? Number(length) : null,
        encoded: encoding !== undefined && encoding !== "" && encoding !== "identity",
        body: response,
        close: () => response.destroy(),
      });
    });
    request.end();
  });

const defaultDeps: ImageFetchDeps = { resolve: defaultResolve, request: defaultRequest };

/** The addresses to connect to, or null when the host can't be resolved or any of its answers is not public. */
async function publicAddresses(url: URL, deps: ImageFetchDeps, signal: AbortSignal): Promise<string[] | null> {
  const host = url.hostname.startsWith("[") ? url.hostname.slice(1, -1) : url.hostname;
  const addresses = net.isIP(host) ? [host] : await deps.resolve(host, signal);
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) return null;
  return addresses;
}

/** The body up to `IMAGE_MAX_BYTES`, or `"too-big"` as soon as it goes over. */
async function readBody(response: ImageResponse): Promise<Buffer | "too-big"> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > IMAGE_MAX_BYTES) return "too-big";
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export type ImageFetchResult =
  | { ok: true; bytes: Buffer }
  | { ok: false; error: Extract<RacquetErrorFlag, "image-fetch" | "image-size"> };

const failed = (error: "image-fetch" | "image-size"): ImageFetchResult => ({ ok: false, error });

/**
 * Gets the bytes behind `link` (already through `parseImageLink`). Never
 * throws: every way of not getting an answer is `image-fetch`; a body over
 * `IMAGE_MAX_BYTES` is `image-size`. Whether the bytes are an image is for the caller.
 */
export async function fetchImageFromLink(link: URL, deps: ImageFetchDeps = defaultDeps): Promise<ImageFetchResult> {
  const signal = AbortSignal.timeout(TOTAL_TIMEOUT_MS);
  let url = link;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const addresses = await publicAddresses(url, deps, signal);
      if (!addresses) return failed("image-fetch");

      const response = await deps.request(url, addresses, signal);
      try {
        if (REDIRECT_STATUSES.has(response.status)) {
          // Each hop gets the full treatment: https only, and its host resolved and vetted afresh.
          const next = response.location ? checkedUrl(() => new URL(response.location as string, url)) : null;
          if (!next) return failed("image-fetch");
          url = next;
          continue;
        }
        if (response.status !== 200 || response.encoded) return failed("image-fetch");
        if (response.contentLength !== null && response.contentLength > IMAGE_MAX_BYTES) return failed("image-size");
        const body = await abortable(readBody(response), signal);
        return body === "too-big" ? failed("image-size") : { ok: true, bytes: body };
      } finally {
        response.close();
      }
    }
    return failed("image-fetch"); // more redirects than allowed
  } catch (error) {
    // Timeouts, resets, TLS failures, unresolvable hosts: all just "couldn't fetch".
    // Only the error's class is logged: Node puts the host or IP of the link in `message`
    // (`getaddrinfo ENOTFOUND <host>`), and the link must never reach a log.
    const code = (error as NodeJS.ErrnoException | null)?.code;
    const name = error instanceof Error ? error.name : typeof error;
    console.error("Fetching a racquet image link failed:", code ? `${name} ${code}` : name);
    return failed("image-fetch");
  }
}
