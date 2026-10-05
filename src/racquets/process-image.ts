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
 * How far a pixel may differ from the border colour (sharp's trim measures the
 * largest difference on any channel, 0-255) and still count as border. Enough
 * to swallow JPEG noise and a faint drop shadow on a white background, small
 * enough to keep the racquet's anti-aliased edge. A transparent border is
 * read from the alpha channel, whatever colour sits under it.
 */
const TRIM_THRESHOLD = 20;

/**
 * The height every racquet is scaled to on the canvas: the four built-ins are
 * all 1410px tall, centred (45px above and below on the 1500px canvas), so a
 * racquet looks the same size whatever its photo's margins were.
 */
const FRAME_HEIGHT = 1410;

/**
 * What is left after trimming must be at least this big to be a racquet:
 * 100px on the long side and 20px on the short one. A thinner remainder is a
 * stray line or speck, and scaling it up to 1410px would be garbage.
 */
const MIN_CONTENT_LONG_SIDE = 100;
const MIN_CONTENT_SHORT_SIDE = 20;

/** A trimmed picture whose every channel varies less than this (standard deviation) is one flat colour. */
const FLAT_STDEV = 2;

/**
 * Turns an uploaded photo into the site's racquet photo, matching the four
 * built-in ones: a 1000x1500 WebP whose racquet is 1410px tall (or 1000px
 * wide, if it is wider than that frame allows), centred both ways on a
 * transparent canvas. So the racquet's size doesn't depend on how much
 * margin the photo has.
 *
 * Steps: turn the photo upright from its EXIF orientation; trim the uniform
 * border (the colour of the top-left pixel, or full transparency, within
 * `TRIM_THRESHOLD`); scale what's left to fit 1000x1410; centre it.
 *
 * What it does not do: remove the background (the photo keeps whatever it has
 * inside the trimmed box) or cope with a non-uniform background. A shadow or
 * gradient darker than `TRIM_THRESHOLD` stops the trim, so the box includes
 * it and the racquet comes out smaller; a busy background trims nothing, and
 * the whole photo is scaled to fit. All metadata (GPS included) is dropped.
 *
 * Returns null when the bytes aren't a readable image in an accepted format,
 * or when nothing is left of it to show: a blank or single-colour picture, or
 * one that trims down to a sliver. The caller reports both as `image-type`.
 */
export async function toRacquetWebp(input: Buffer): Promise<Buffer | null> {
  try {
    const source = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
    const metadata = await source.metadata();
    if (!isAcceptedImage(metadata)) return null;

    // First frame only: an animated GIF or WebP becomes a still. Raw RGBA
    // lets the trimmed size be read before deciding to scale it.
    // The call order is not the run order: sharp trims in the file's own
    // orientation, then rotates. For a uniform border that finds the same box
    // as rotating first (the EXIF test pins it).
    const { data, info } = await source
      .rotate()
      .trim({ threshold: TRIM_THRESHOLD })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height } = info;
    const rawInput = { raw: { width, height, channels: 4 as const } };

    if (Math.max(width, height) < MIN_CONTENT_LONG_SIDE || Math.min(width, height) < MIN_CONTENT_SHORT_SIDE) {
      return null;
    }
    // Trim leaves a uniform picture whole (there is no border to find), so a
    // blank or single-colour image gets past the size check above.
    const { channels } = await sharp(data, rawInput).stats();
    if (channels.every((channel) => channel.stdev < FLAT_STDEV)) return null;

    const scale = Math.min(IMAGE_SIZE.width / width, FRAME_HEIGHT / height);
    const fittedWidth = Math.max(1, Math.round(width * scale));
    const fittedHeight = Math.max(1, Math.round(height * scale));
    const left = Math.round((IMAGE_SIZE.width - fittedWidth) / 2);
    const top = Math.round((IMAGE_SIZE.height - fittedHeight) / 2);

    return await sharp(data, rawInput)
      .resize(fittedWidth, fittedHeight, { fit: "fill" })
      .extend({
        left,
        right: IMAGE_SIZE.width - fittedWidth - left,
        top,
        bottom: IMAGE_SIZE.height - fittedHeight - top,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    // Corrupt, truncated, or over the pixel limit: all "not a usable image".
    return null;
  }
}
