import { NextResponse, type NextRequest } from "next/server";
import { loginPath } from "@/auth/safe-next-path";
import { readSession } from "@/auth/session";

/**
 * Sends visitors who open a reviewers-only page to the login page, with a
 * real HTTP redirect (307) before any of the page is sent.
 *
 * Why here and not only in the page: with Cache Components the page's
 * static shell is sent first, so a redirect() while rendering can only
 * arrive as a <meta> refresh inside a 200. That works, but a second late
 * and without JavaScript. This check runs before rendering starts.
 *
 * It's the quick check only: a signed, unexpired session cookie. It can't
 * see a password reset (that needs the database), so each page still calls
 * getCurrentReviewer(), which is the real boundary, and redirects itself.
 *
 * Page loads only (GET/HEAD). A POST is a Server Action, which checks
 * getCurrentReviewer() itself; redirecting it would make the browser re-send
 * its form body to /login.
 */
export async function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();
  if (await readSession()) return NextResponse.next();
  return NextResponse.redirect(new URL(loginPath(request.nextUrl.pathname), request.url));
}

// Reviewers-only pages all live under /account, so a new one is covered
// without touching this list. Everything else is public and skips the proxy.
export const config = {
  matcher: "/account/:path*",
};
