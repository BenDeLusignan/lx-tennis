"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/button";
import { localToday } from "./local-date";

interface TodayButtonProps {
  /** The date input it fills; must match the input's id in page.tsx. */
  inputId: string;
}

/**
 * "Today" beside the date-strung field: fills the date input with today in
 * the reviewer's own time zone (always accepted; see local-date.ts for why).
 *
 * A progressive enhancement: until the page has hydrated, the button is not
 * rendered at all, because without JavaScript a tap could do nothing and
 * the control would only look usable. The form is complete without it — the
 * date is typed by hand — so the site's "forms work before JavaScript"
 * convention is untouched. useSyncExternalStore is the effect-free way to
 * know the page has hydrated (a mount effect would re-render after the
 * fact; this snapshots "hydrated" for the client and "not" for the server).
 * The short visible label keeps the row compact on phones; the aria-label
 * says exactly what the button does and which field it fills.
 */
export function TodayButton({ inputId }: TodayButtonProps) {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!hydrated) return null;

  return (
    <Button
      type="button"
      aria-label="Set date strung to today"
      onClick={() => {
        const input = document.getElementById(inputId);
        if (input instanceof HTMLInputElement) {
          // Value and max from one computed today, so the two can't disagree.
          // The max must be refreshed too: SetupFormConstraints sets it once
          // at mount, so a page left open past local midnight would keep
          // yesterday's max and refuse the date this button just filled.
          const today = localToday();
          input.max = today;
          input.value = today;
        }
      }}
    >
      Today
    </Button>
  );
}