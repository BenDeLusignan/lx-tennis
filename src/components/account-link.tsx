"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The logged-in reviewer's name in the header, linking to their account
 * page. A client component only for the same reason as `LoginLink`: the
 * shared header can't see the current path on the server.
 *
 * On /account it stays a link but is marked as the current page, rather
 * than disappearing like "Log in" does on /login: the name is also how you
 * see who's logged in, so the header shouldn't change from page to page.
 */
export function AccountLink({ displayName, className }: { displayName: string; className?: string }) {
  const isCurrent = usePathname() === "/account";

  // The accessible name starts with the visible name ("Ben, your account"),
  // so voice control ("click Ben") matches what's on screen, and the rest
  // says where the link goes.
  return (
    <Link href="/account" aria-current={isCurrent ? "page" : undefined} className={className}>
      {displayName}
      <span className="visually-hidden">, your account</span>
    </Link>
  );
}
