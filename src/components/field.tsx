import type { ReactNode } from "react";
import styles from "./field.module.css";

interface FieldProps {
  label: ReactNode;
  /** The id of the control, which the label points at. */
  htmlFor: string;
  /** The control, then any hint (give it an id and point the control's `aria-describedby` at it). */
  children: ReactNode;
  className?: string;
}

/**
 * A label above its control, the layout every form on the site uses. A
 * component so that no field can go without a visible label.
 */
export function Field({ label, htmlFor, children, className }: FieldProps) {
  return (
    <div className={className ? `${styles.field} ${className}` : styles.field}>
      <label htmlFor={htmlFor} className={styles.label}>
        {label}
      </label>
      {children}
    </div>
  );
}
