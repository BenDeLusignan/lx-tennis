"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/button";

/**
 * A client component only for the "Logging in…" label while the action runs,
 * which matters on weak signal at the court. Not disabled while pending:
 * disabling the focused button would drop keyboard focus to the page, and a
 * second submit is harmless.
 */
export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary">
      {pending ? "Logging in…" : "Log in"}
    </Button>
  );
}
