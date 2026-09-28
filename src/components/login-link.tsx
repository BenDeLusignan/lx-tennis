"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * "Log in" link that brings the reviewer back to this page afterwards. A
 * client component only because the server can't see the current path from
 * a shared header; the login action re-validates `next` either way.
 */
export function LoginLink({ className }: { className?: string }) {
  const pathname = usePathname();
  // On /login the form's own Log in button is the only control of that name.
  if (pathname === "/login") return null;

  const href = pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`;
  return (
    <Link href={href} className={className}>
      Log in
    </Link>
  );
}
