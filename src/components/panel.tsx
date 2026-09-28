import Link from "next/link";
import type { ComponentProps } from "react";
import styles from "./panel.module.css";

type PanelProps =
  /** A content block. Name it with `aria-labelledby` pointing at its heading. */
  | (ComponentProps<"section"> & { href?: undefined })
  /**
   * A whole-card link. The caller's `className` sets its layout (`display`,
   * gaps); the panel supplies the surface and the hover and focus states.
   */
  | ComponentProps<typeof Link>;

/**
 * The raised surface that cards and content blocks sit on. With `href` it
 * renders a link that glows pink on hover; without, a `<section>`.
 */
export function Panel(props: PanelProps) {
  if (props.href !== undefined) {
    const { className, ...linkProps } = props;
    return <Link className={classes(`${styles.panel} ${styles.link}`, className)} {...linkProps} />;
  }

  const { className, ...sectionProps } = props;
  return <section className={classes(styles.panel, className)} {...sectionProps} />;
}

function classes(own: string, extra: string | undefined) {
  return extra ? `${own} ${extra}` : own;
}
