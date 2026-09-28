// Any origin works as the base: only whether parsing keeps it matters.
const BASE = new URL("http://same-origin.invalid");

/**
 * Where to send someone after logging in. Only same-origin paths are
 * allowed, so `/login?next=https://evil.example` can't turn the login page
 * into an open redirect; anything else, or the login page itself, gives "/".
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/")) return "/";

  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return "/";
  }
  // Catches `//evil.example` and `/\evil.example`, which browsers read as
  // another host, and tabs or newlines the URL parser strips out.
  if (url.origin !== BASE.origin) return "/";

  const path = `${url.pathname}${url.search}${url.hash}`;
  // Dot-segment cleanup can turn `/.//evil.example` into `//evil.example`.
  if (path.startsWith("//") || url.pathname === "/login") return "/";
  return path;
}
