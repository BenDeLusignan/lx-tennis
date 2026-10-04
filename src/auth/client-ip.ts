import "server-only";
import { isIP } from "node:net";
import { headers } from "next/headers";

/**
 * The client's address for the failed-attempt limiter, or null when no
 * header carries one.
 *
 * Vercel sets `x-forwarded-for` to the client's public IP and overwrites
 * whatever the client sent: "we currently overwrite the X-Forwarded-For
 * header and do not forward external IPs. This restriction is in place to
 * prevent IP spoofing" (Vercel docs, Request headers). So it's the one
 * header the docs pin down as unspoofable, and it's tried first.
 * `x-vercel-forwarded-for` and `x-real-ip` are documented as identical to
 * it, so they're fallbacks only if it's absent.
 *
 * Uncertainty: the docs don't say who may set `x-vercel-forwarded-for`, so
 * it isn't trusted ahead of `x-forwarded-for`. The overwrite applies to a
 * client talking to Vercel directly; if a proxy or CDN is ever put in front,
 * that proxy's `x-forwarded-for` value would be the one seen, so this order
 * would need flipping to `x-vercel-forwarded-for` (which the docs describe as
 * unaffected by a proxy). And off Vercel (`next dev`, `next start`) nothing
 * overwrites the header, so a client could set it: the limiter is only as
 * strong as the header there, which is fine for local use.
 *
 * Read per request, and only a valid IPv4 or IPv6 literal is accepted.
 */
export async function clientIp(): Promise<string | null> {
  const requestHeaders = await headers();
  for (const name of ["x-forwarded-for", "x-vercel-forwarded-for", "x-real-ip"]) {
    // A list means a chain of proxies; the first entry is the client.
    const first = requestHeaders.get(name)?.split(",")[0]?.trim();
    if (first && isIP(first) !== 0) return addressBucket(first);
  }
  return null;
}

/**
 * What the limiter counts as "one address". An IPv4 address is itself. An
 * IPv6 one is its /64: every home and mobile connection is handed a whole
 * /64, so counting single IPv6 addresses would let one machine rotate through
 * billions of them and never meet a limit. Mapped IPv4 (`::ffff:1.2.3.4`)
 * is the IPv4 address. Expects a valid IP literal.
 */
export function addressBucket(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  if (isIP(ip) !== 6) return ip;

  const [address] = ip.split("%"); // a zone id (fe80::1%eth0) isn't part of the address
  const [head, tail] = address.split("::");
  const front = head ? head.split(":") : [];
  // `::` stands for however many zero groups make eight. An embedded IPv4
  // tail (::1.2.3.4) is two groups, but it's in the last 32 bits, which a
  // /64 never reads, so a placeholder is enough.
  const back = tail === undefined ? [] : tail ? tail.split(":").map((g) => (g.includes(".") ? "0" : g)) : [];
  const groups =
    tail === undefined ? front : [...front, ...Array<string>(8 - front.length - back.length).fill("0"), ...back];

  return `${groups.slice(0, 4).map((group) => parseInt(group, 16).toString(16)).join(":")}::/64`;
}
