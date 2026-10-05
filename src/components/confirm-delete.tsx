import type { ReactNode } from "react";
import { Button } from "@/components/button";
import styles from "./confirm-delete.module.css";

interface ConfirmDeleteProps {
  /** The closed state's text, e.g. "Delete your review…". */
  summary: string;
  /** What deleting does, shown once opened. Say what stays and what goes. */
  warning: ReactNode;
  /** The label of the real delete button, e.g. "Yes, delete my review". */
  confirmLabel: string;
  /** The Server Action the button posts to. */
  action: (formData: FormData) => void | Promise<void>;
  /** The form's hidden fields (which setup, which racquet). */
  children?: ReactNode;
}

/**
 * Two-step delete: a `<details>` (so it works before JavaScript loads) that
 * opens to what deleting does and the real button, a Server Action POST. One
 * component for "Delete your review" and "Delete this racquet", so every
 * delete on the site asks the same way. The caller still checks on the server
 * that the delete is allowed; this is only what the page offers.
 */
export function ConfirmDelete({
  summary,
  warning,
  confirmLabel,
  action,
  children,
}: ConfirmDeleteProps) {
  return (
    <details className={styles.confirm}>
      <summary className={styles.summary}>{summary}</summary>
      <form action={action} className={styles.form}>
        {children}
        <p className={styles.warning}>{warning}</p>
        {/* Wraps the lone button: a bare button in a column-flex form would stretch to the full width. */}
        <div className={styles.actions}>
          <Button type="submit">{confirmLabel}</Button>
        </div>
      </form>
    </details>
  );
}
