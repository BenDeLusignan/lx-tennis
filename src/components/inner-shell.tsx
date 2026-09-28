import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";

/**
 * The frame for every page except the landing page (which uses its hero as
 * the banner): the site header, then the page's one <main id="main">, which
 * is where the skip link in the root layout jumps to.
 *
 * Used by `app/(inner)/layout.tsx` for normal pages, and by `app/not-found.tsx`,
 * because Next renders the root 404 outside every route group, so it can't
 * inherit that layout.
 */
export function InnerShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main">{children}</main>
    </>
  );
}
