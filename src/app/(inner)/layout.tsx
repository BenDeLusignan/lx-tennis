import { InnerShell } from "@/components/inner-shell";

// Every page in this route group gets the header and <main id="main"> from
// here, so a new page can't forget them. The group's folder name doesn't
// appear in URLs: app/(inner)/racquets/page.tsx is served at /racquets.
export default function InnerLayout({ children }: LayoutProps<"/">) {
  return <InnerShell>{children}</InnerShell>;
}
