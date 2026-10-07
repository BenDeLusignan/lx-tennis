import Image from "next/image";
import type { RacquetImage } from "@/data/racquets";
import styles from "./racquet-photo.module.css";

interface RacquetPhotoProps {
  image: RacquetImage;
  /** `sizes` hint for next/image; must match the rendered width at each breakpoint. */
  sizes: string;
  /** Set for the page's largest above-the-fold image. */
  preload?: boolean;
  className?: string;
}

/**
 * Racquet photo on a white sheet. The photos are opaque white-background
 * images, so every racquet shows in the same box on the dark theme; the
 * styling is in racquet-photo.module.css.
 */
export function RacquetPhoto({ image, sizes, preload = false, className }: RacquetPhotoProps) {
  return (
    <div className={className ? `${styles.stage} ${className}` : styles.stage}>
      <Image
        className={styles.image}
        src={image.src}
        width={image.width}
        height={image.height}
        alt={image.alt}
        sizes={sizes}
        preload={preload}
      />
    </div>
  );
}
