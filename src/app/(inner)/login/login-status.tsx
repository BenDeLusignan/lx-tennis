"use client";

import { useEffect, type ReactNode } from "react";

/**
 * The login page's status message: wrong details, a lockout, or the limiter
 * being unavailable. A client component only to move focus to the first field
 * (the email box) when it appears: whichever it is, the page reloads
 * with both fields empty, so focusing the first one opens the phone keyboard
 * where the retry starts, and the field's aria-describedby then reads this
 * message out. Without it, clicking Log in leaves focus nowhere useful.
 */
export function LoginStatus({ className, children }: { className?: string; children: ReactNode }) {
  useEffect(() => {
    document.getElementById("email")?.focus();
  }, []);

  return <span className={className}>{children}</span>;
}
