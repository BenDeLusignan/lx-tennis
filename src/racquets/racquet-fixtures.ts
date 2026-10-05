import type { ImageStore } from "@/racquets/image-store";
import sharp, { type Sharp } from "sharp";

/** Where a racquet sits on a photo: its box in pixels, top-left origin. */
export type RacquetBox = { left: number; top: number; width: number; height: number };

/**
 * A synthetic racquet photo: a dark racquet (oval head, stroked, on a handle)
 * whose outer edge fills `box` exactly, on a `width` x `height` canvas. With
 * a `background` colour the canvas is opaque; with none it is transparent.
 * `shadowSvg` is more SVG, drawn between the background and the racquet (a shadow).
 * Returns a sharp pipeline, so the caller picks the format.
 */
export function racquetPhoto(options: {
  width: number;
  height: number;
  box: RacquetBox;
  background?: string;
  shadowSvg?: string;
}): Sharp {
  const { width, height, box, background, shadowSvg = "" } = options;
  const stroke = Math.max(2, Math.round(box.width * 0.06));
  const headHeight = Math.round(box.height * 0.6);
  const handleWidth = Math.max(2, Math.round(box.width * 0.12));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    ${background ? `<rect width="${width}" height="${height}" fill="${background}"/>` : ""}
    ${shadowSvg}
    <ellipse cx="${box.left + box.width / 2}" cy="${box.top + headHeight / 2}" rx="${(box.width - stroke) / 2}" ry="${(headHeight - stroke) / 2}" fill="none" stroke="#202020" stroke-width="${stroke}"/>
    <rect x="${box.left + (box.width - handleWidth) / 2}" y="${box.top + headHeight - stroke}" width="${handleWidth}" height="${box.height - headHeight + stroke}" fill="#202020"/>
  </svg>`;
  return sharp(Buffer.from(svg));
}

/** A photo of a racquet (80% of the photo's height, 1:3 width:height) on plain white, in the given format. */
export function racquetImage(
  width = 600,
  height = 400,
  format: "png" | "jpeg" | "webp" | "gif" | "avif" = "png",
): Promise<Buffer> {
  const racquetHeight = Math.round(height * 0.8);
  const racquetWidth = Math.round(racquetHeight / 3);
  return racquetPhoto({
    width,
    height,
    background: "#ffffff",
    box: {
      left: Math.round((width - racquetWidth) / 2),
      top: Math.round((height - racquetHeight) / 2),
      width: racquetWidth,
      height: racquetHeight,
    },
  })
    [format]()
    .toBuffer();
}

/** An in-memory image store that records what was saved and removed. */
export class FakeImageStore implements ImageStore {
  saved = new Map<string, Buffer>();
  removed: string[] = [];
  failSave = false;
  /** Counts every save, even after a remove, so no two saved URLs are alike. */
  private saves = 0;
  /** Runs after the image is stored, before the row is written: where a race can happen. */
  afterSave: (slug: string) => Promise<void> = async () => {};

  reset(): void {
    this.saved.clear();
    this.removed = [];
    this.failSave = false;
    this.afterSave = async () => {};
  }

  async save(slug: string, webp: Buffer): Promise<string> {
    if (this.failSave) throw new Error("the store is down");
    const src = `https://fake.public.blob.vercel-storage.com/racquets/${slug}-${this.saves++}.webp`;
    this.saved.set(src, webp);
    await this.afterSave(slug);
    return src;
  }

  async remove(src: string): Promise<void> {
    this.removed.push(src);
    this.saved.delete(src);
  }
}
