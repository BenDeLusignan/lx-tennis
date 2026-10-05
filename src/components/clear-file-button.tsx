"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/button";

/**
 * "Remove the chosen file", shown only once JavaScript has loaded and a file
 * is chosen. The photo is either a file or a link, and a phone's file input
 * has no way to un-choose a file: without this, someone who picked a file and
 * then decided to paste a link would be stuck with "not both" until they
 * reloaded the page and re-typed everything. Without JavaScript the page
 * still works (the server refuses both with its own message), this just
 * makes the either/or easy to act on.
 *
 * It renders nothing on the server and on the first client render, so the
 * prerendered page and the hydrated one match.
 */
export function ClearFileButton({ inputId, className }: { inputId: string; className?: string }) {
  const [hasFile, setHasFile] = useState(false);

  useEffect(() => {
    const input = document.getElementById(inputId);
    if (!(input instanceof HTMLInputElement)) return;

    const sync = () => setHasFile((input.files?.length ?? 0) > 0);
    sync();
    input.addEventListener("change", sync);
    return () => input.removeEventListener("change", sync);
  }, [inputId]);

  if (!hasFile) return null;

  return (
    <Button
      type="button"
      className={className}
      onClick={() => {
        const input = document.getElementById(inputId);
        if (!(input instanceof HTMLInputElement)) return;
        input.value = "";
        // Tell the rest of the form (RacquetFormConstraints listens for
        // `change` on the form) and our own listener, then put focus back
        // where the button was, because the button is about to disappear.
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.focus();
      }}
    >
      Remove the chosen file
    </Button>
  );
}
