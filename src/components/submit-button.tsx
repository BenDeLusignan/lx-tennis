"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/button";

interface SubmitButtonProps {
  children: ReactNode;
  /** Shown while the form's action runs, e.g. "Saving…". */
  pendingLabel: ReactNode;
}

/**
 * A form's primary submit button, with a pending label while its action
 * runs, which matters on weak signal at the court. A client component only
 * for that label; before JavaScript loads it's a plain submit button.
 *
 * Not disabled while pending: disabling the focused button would drop
 * keyboard focus to the page, and a second submit is harmless (actions
 * refuse duplicates).
 */
export function SubmitButton({ children, pendingLabel }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary">
      {pending ? pendingLabel : children}
    </Button>
  );
}
