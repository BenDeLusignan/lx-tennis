import type { ComponentProps } from "react";
import styles from "./input.module.css";

/*
 * The site's text-field look, shared by <input>, <select> and <textarea> so
 * the three can't drift apart. A caller's className adds to it (e.g. for
 * width), as with Button.
 */

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={classes(className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={classes(className)} {...props} />;
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${classes(className)} ${styles.textarea}`} {...props} />;
}

function classes(extra: string | undefined) {
  return extra ? `${styles.input} ${extra}` : styles.input;
}
