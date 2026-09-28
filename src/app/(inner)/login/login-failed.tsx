"use client";

import { useEffect, type ReactNode } from "react";

/**
 * The failed-login message. A client component only to move focus to the
 * username field when it appears: a failed login reloads the page with both
 * fields empty, so focusing the first one opens the phone keyboard where the
 * retry starts, and the field's aria-describedby then reads this message out.
 * Without it, clicking Log in leaves focus nowhere useful.
 */
export function LoginFailed({ className, children }: { className?: string; children: ReactNode }) {
  useEffect(() => {
    document.getElementById("username")?.focus();
  }, []);

  return <span className={className}>{children}</span>;
}
