import type { ReactNode } from "react";
import styles from "./form-actions.module.css";

/**
 * The Save + Cancel row at the foot of a review form: two equal columns that
 * together are as wide as the fields above. Give both buttons `fill` so they
 * fill their cell. One shared row, so the three forms that end in a
 * submit + Cancel pair (new setup, add review, edit review) can't drift.
 */
export function FormActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}
