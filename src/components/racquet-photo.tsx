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
 * Racquet photo on the light "display case" stage. The stage keeps dark
 * frames legible on the dark theme and gives every racquet the same box.
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
