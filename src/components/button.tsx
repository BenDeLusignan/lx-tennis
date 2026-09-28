import Link from "next/link";
import type { ComponentProps } from "react";
import styles from "./button.module.css";

interface ButtonLook {
  /**
   * `primary` (filled pink) for the one action a form exists for, like
   * logging in; `secondary` (cyan outline, the default) for everything
   * else, like the header's Log in and Log out.
   */
  variant?: "primary" | "secondary";
}

type ButtonProps =
  | (ComponentProps<"button"> & ButtonLook & { href?: undefined })
  /** A link that looks like a button, e.g. the header's "Log in". */
  | (ComponentProps<typeof Link> & ButtonLook);

/**
 * The site's button look, for a `<button>` or (with `href`) a link. Same
 * shape as `Panel`: one component for both, so a link and a button that sit
 * side by side can't drift apart.
 */
export function Button({ variant = "secondary", ...props }: ButtonProps) {
  if (props.href !== undefined) {
    const { className, ...linkProps } = props;
    return <Link className={classes(variant, className)} {...linkProps} />;
  }

  const { className, ...buttonProps } = props;
  return <button className={classes(variant, className)} {...buttonProps} />;
}

// A caller's className adds to the button styles (e.g. for width) rather than replacing them.
function classes(variant: "primary" | "secondary", extra: string | undefined) {
  const own = `${styles.button} ${styles[variant]}`;
  return extra ? `${own} ${extra}` : own;
}
