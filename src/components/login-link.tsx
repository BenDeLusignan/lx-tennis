"use client";

import { usePathname } from "next/navigation";
import { loginPath } from "@/auth/safe-next-path";
import { Button } from "@/components/button";

/**
 * "Log in" link that brings the reviewer back to this page afterwards. A
 * client component only because the server can't see the current path from
 * a shared header; the login action re-validates `next` either way.
 */
export function LoginLink() {
  const pathname = usePathname();
  // On /login the form's own Log in button is the only control of that name.
  if (pathname === "/login") return null;

  return <Button href={loginPath(pathname)}>Log in</Button>;
}
