import "server-only";
import sharp, { type Metadata } from "sharp";
import { IMAGE_SIZE } from "@/data/racquets";
import { IMAGE_TYPES } from "@/racquets/racquet-form";

/**
 * Whether sharp's reading of the bytes is one of `IMAGE_TYPES`, the list the
 * file input's `accept` comes from. sharp reads more (SVG, HEIC where
 * available); an SVG is code to render rather than a photo.
 */
function isAcceptedImage({ format, compression }: Metadata): boolean {
  return IMAGE_TYPES.some(
    (type) => type.format === format && (!("compression" in type) || type.compression === compression),
  );
}

/** Decoding is the expensive step, so refuse a decompression bomb before it: 50 megapixels. */
const MAX_INPUT_PIXELS = 50_000_000;

/**
 * Turns an uploaded photo into the site's racquet photo: a 1000x1500 WebP
 * with the picture scaled to fit and centred at the top of a transparent
 * canvas, the way the built-in racquets are. The canvas is the same for every
 * racquet, but the racquet's size in it depends on the photo: margins are not
 * trimmed. The background is not made transparent either: the photo keeps
 * whatever it has. Phone photos are turned upright from their EXIF
 * orientation, and all metadata (GPS included) is dropped.
 *
 * Returns null when the bytes aren't a readable image in an accepted format.
 */
export async function toRacquetWebp(input: Buffer): Promise<Buffer | null> {
  try {
    const source = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
    const metadata = await source.metadata();
    if (!isAcceptedImage(metadata)) return null;

    // First frame only: an animated GIF or WebP becomes a still.
    const fitted = await source
      .rotate()
      .resize(IMAGE_SIZE.width, IMAGE_SIZE.height, { fit: "inside" })
      .toBuffer();

    return await sharp({
      create: {
        ...IMAGE_SIZE,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: fitted, gravity: "north" }])
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    // Corrupt, truncated, or over the pixel limit: all "not a usable image".
    return null;
  }
}
