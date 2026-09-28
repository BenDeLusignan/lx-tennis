import type { ComponentProps } from "react";
import styles from "./section-title.module.css";

interface SectionTitleProps extends ComponentProps<"h2"> {
  /** Pick the level that keeps the page's headings in order; the look stays the same. */
  as?: "h1" | "h2" | "h3";
  /** `xl` for a page section, `lg` for a heading inside a `Panel`. */
  size?: "lg" | "xl";
}

/** The pink glowing heading that opens a section. */
export function SectionTitle({
  as: Heading = "h2",
  size = "xl",
  className,
  ...props
}: SectionTitleProps) {
  // A caller's className adds to the title styles rather than replacing them.
  const own = `${styles.title} ${styles[size]}`;
  return <Heading className={className ? `${own} ${className}` : own} {...props} />;
}
