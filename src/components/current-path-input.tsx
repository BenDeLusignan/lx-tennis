"use client";

import { usePathname } from "next/navigation";

/**
 * Hidden form field holding the current page's path, so an action can send
 * the user back here (the log out form uses it). A client component because
 * a shared header rendered on the server can't see the path. The action
 * must still validate it: it's user input.
 */
export function CurrentPathInput({ name }: { name: string }) {
  return <input type="hidden" name={name} value={usePathname()} />;
}
