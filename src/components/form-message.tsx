"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./form-message.module.css";

interface FormMessageProps {
  /** `error` (pink) when the save was refused; `success` (cyan) when it worked. */
  tone: "error" | "success";
  children: ReactNode;
}

/**
 * The result of submitting a form, read from a URL flag after the action's
 * redirect (e.g. `?error=tension`). Every one of these answers something the
 * reviewer just did, so focus moves to it: a screen reader reads it out,
 * and the page scrolls to it. Without that, the reload leaves focus at the
 * top of the page and the message is easy to miss. Before JavaScript loads
 * it's just the message, near the top of the form.
 *
 * Render it with a fresh `key` per response (as the login page does for
 * LoginFailed), so the same message twice in a row is focused again.
 */
export function FormMessage({ tone, children }: FormMessageProps) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <p ref={ref} tabIndex={-1} className={`${styles.message} ${styles[tone]}`}>
      {children}
    </p>
  );
}
