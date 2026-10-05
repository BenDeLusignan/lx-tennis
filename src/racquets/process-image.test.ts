import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { toRacquetWebp } from "@/racquets/process-image";
import { racquetImage, racquetPhoto, type RacquetBox } from "@/racquets/racquet-fixtures";

type Box = { left: number; top: number; width: number; height: number };

/** Bounding box of the pixels `pick` accepts (RGBA), or null if none do. */
async function boxOf(webp: Buffer, pick: (r: number, g: number, b: number, a: number) => boolean): Promise<Box | null> {
  const { data, info } = await sharp(webp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let right = -1;
  let top = info.height;
  let bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      if (!pick(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Where the photo's content is on the canvas: everything that isn't transparent. */
async function contentBox(webp: Buffer): Promise<Box> {
  const box = await boxOf(webp, (_r, _g, _b, a) => a > 128);
  assert.ok(box, "something is drawn");
  return box;
}

/** Where the dark racquet itself is, wherever the background and shadow end. */
async function racquetBox(webp: Buffer): Promise<Box> {
  const box = await boxOf(webp, (r, g, b, a) => a > 128 && r < 100 && g < 100 && b < 100);
  assert.ok(box, "a racquet is drawn");
  return box;
}

function assertClose(actual: number, expected: number, tolerance: number, label: string): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual}, expected ${expected} ± ${tolerance}`);
}

/** The built-in photos: racquet 1410px tall, 45px above and below, centred on 1000x1500. */
function assertBuiltInFrame(box: Box, label: string): void {
  assertClose(box.height, 1410, 3, `${label} height`);
  assertClose(box.top, 45, 3, `${label} top`);
  assertClose(box.left + box.width / 2, 500, 3, `${label} horizontal centre`);
}

/** A synthetic racquet photo (see `racquetPhoto`) as a PNG. */
function photoPng(options: Parameters<typeof racquetPhoto>[0]): Promise<Buffer> {
  return racquetPhoto(options).png().toBuffer();
}

const RACQUET: RacquetBox = { left: 400, top: 200, width: 200, height: 600 };
const TIGHT: RacquetBox = { left: 0, top: 0, width: 200, height: 600 };

test("a photo with wide margins and a tight crop of the same racquet come out the same size", async () => {
  const wide = await toRacquetWebp(await photoPng({ width: 1000, height: 1000, box: RACQUET, background: "#fff" }));
  const tight = await toRacquetWebp(await photoPng({ width: 200, height: 600, box: TIGHT, background: "#fff" }));
  assert.ok(wide && tight);

  for (const [webp, label] of [[wide, "wide margins"], [tight, "tight crop"]] as const) {
    const meta = await sharp(webp).metadata();
    assert.deepEqual([meta.width, meta.height], [1000, 1500], label);
    const content = await contentBox(webp);
    assertBuiltInFrame(content, label);
    // 200x600 scaled to 1410 tall is 470 wide; the built-in widths run 424-558.
    assertClose(content.width, 470, 3, `${label} width`);
  }
  const a = await contentBox(wide);
  const b = await contentBox(tight);
  assertClose(a.width, b.width, 3, "widths agree");
  assertClose(a.height, b.height, 3, "heights agree");
});

test("a racquet the shape of the VCORE 98 photo lands where the built-in one does (x 276-723, y 45-1454)", async () => {
  // VCORE 98 proportions: 448 wide × 1410 tall. The box below is that ratio at half scale (224 × 705).
  const webp = await toRacquetWebp(
    await racquetPhoto({
      width: 900,
      height: 900,
      box: { left: 300, top: 100, width: 224, height: 705 },
      background: "#fff",
    })
      .jpeg({ quality: 90 })
      .toBuffer(),
  );
  assert.ok(webp);
  const content = await contentBox(webp);
  assertClose(content.left, 276, 3, "left");
  assertClose(content.left + content.width - 1, 723, 3, "right");
  assertClose(content.top, 45, 3, "top");
  assertClose(content.top + content.height - 1, 1454, 3, "bottom");
});

test("JPEG noise on a white background doesn't stop the trim", async () => {
  const webp = await toRacquetWebp(
    await racquetPhoto({ width: 1000, height: 1000, box: RACQUET, background: "#fff" }).jpeg({ quality: 30 }).toBuffer(),
  );
  assert.ok(webp);
  assertBuiltInFrame(await contentBox(webp), "jpeg q30");
});

test("transparent PNG and WebP photos are trimmed on their alpha, not their hidden colour", async () => {
  const pngIn = await photoPng({ width: 1000, height: 1000, box: RACQUET });
  const webpIn = await racquetPhoto({ width: 1000, height: 1000, box: RACQUET }).webp({ lossless: true }).toBuffer();
  for (const [input, label] of [[pngIn, "png"], [webpIn, "webp"]] as const) {
    const webp = await toRacquetWebp(input);
    assert.ok(webp, label);
    const content = await contentBox(webp);
    assertBuiltInFrame(content, label);
    // The background stays transparent: the box holds the racquet and clear pixels.
    const { data, info } = await sharp(webp).raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];
    assert.equal(alphaAt(Math.round(content.left + 5), Math.round(content.top + 700)), 0, `${label} clear beside the handle`);
  }
});

test("a racquet wider than the frame is fitted to the canvas width and centred vertically", async () => {
  // A racquet photographed lying down: 3000x600 content → 1000x200.
  const webp = await toRacquetWebp(
    await photoPng({
      width: 3400,
      height: 1000,
      box: { left: 200, top: 200, width: 3000, height: 600 },
      background: "#fff",
    }),
  );
  assert.ok(webp);
  const content = await contentBox(webp);
  assertClose(content.width, 1000, 2, "width");
  assertClose(content.left, 0, 2, "left");
  assertClose(content.top + content.height / 2, 750, 3, "vertical centre");
});

test("EXIF orientation is applied before the racquet is measured, and metadata is dropped", async () => {
  // Stored sideways (the racquet lying on its side), tagged "rotate 90° clockwise to view".
  const upright = await photoPng({ width: 1000, height: 1000, box: RACQUET, background: "#fff" });
  const sideways = await sharp(upright).rotate(270).withMetadata({ orientation: 6 }).jpeg({ quality: 95 }).toBuffer();
  assert.equal((await sharp(sideways).metadata()).orientation, 6, "the fixture carries the tag");

  const webp = await toRacquetWebp(sideways);
  assert.ok(webp);
  // Ignoring the tag would leave the racquet lying on its side (600×200 in the source), which would fit to 1000×333 instead of 470×1410.
  assertBuiltInFrame(await contentBox(webp), "oriented");
  assert.equal((await sharp(webp).metadata()).exif, undefined);
});

/** The racquet on white, with an ellipse of `fill` as a shadow under it. */
const withShadow = (fill: string): Parameters<typeof racquetPhoto>[0] => ({
  width: 1000,
  height: 1000,
  box: RACQUET,
  background: "#fff",
  shadowSvg: `<ellipse cx="500" cy="840" rx="400" ry="40" fill="${fill}"/>`,
});

test("a faint shadow is trimmed away, so the racquet gets the built-in size", async () => {
  // #f5f5f5 is 10 off white: border.
  const faint = await toRacquetWebp(await photoPng(withShadow("#f5f5f5")));
  assert.ok(faint);
  assertBuiltInFrame(await racquetBox(faint), "faint shadow");
});

test("a dark shadow is kept, so the racquet comes out smaller (documented)", async () => {
  // #bbbbbb is 68 off white: not border, so the box spans the shadow (800 wide,
  // 640 tall), and the racquet inside it is scaled by 1000/800 instead of 1410/600.
  const dark = await toRacquetWebp(await photoPng(withShadow("#bbbbbb")));
  assert.ok(dark);
  const content = await contentBox(dark);
  assertClose(content.width, 1000, 3, "box includes the shadow");
  const racquet = await racquetBox(dark);
  assert.ok(racquet.height < 800, `racquet is smaller (${racquet.height}px), not the built-in 1410px`);
});

test("a photo with no border at all keeps its whole frame", async () => {
  const webp = await toRacquetWebp(await photoPng({ width: 200, height: 600, box: TIGHT, background: "#fff" }));
  assert.ok(webp);
  assertBuiltInFrame(await contentBox(webp), "no border");
});

test("a blank, single-colour or empty picture is refused", async () => {
  const flat = (channels: 3 | 4, background: string | { r: number; g: number; b: number; alpha: number }) =>
    sharp({ create: { width: 800, height: 600, channels, background } });
  const noisyWhite = await sharp({
    create: { width: 800, height: 600, channels: 3, background: "#fff", noise: { type: "gaussian", mean: 250, sigma: 1 } },
  })
    .jpeg({ quality: 40 })
    .toBuffer();

  assert.equal(await toRacquetWebp(await flat(3, "#ffffff").png().toBuffer()), null, "white");
  assert.equal(await toRacquetWebp(await flat(3, "#ffffff").jpeg().toBuffer()), null, "white jpeg");
  assert.equal(await toRacquetWebp(await flat(3, "#ff0080").png().toBuffer()), null, "solid colour");
  assert.equal(await toRacquetWebp(await flat(4, { r: 0, g: 0, b: 0, alpha: 0 }).png().toBuffer()), null, "transparent");
  assert.equal(await toRacquetWebp(await flat(4, { r: 0, g: 0, b: 0, alpha: 0 }).webp().toBuffer()), null, "transparent webp");
  assert.equal(await toRacquetWebp(noisyWhite), null, "noisy white");
});

test("a speck or a thin line left after trimming is refused", async () => {
  // A black rectangle on a white 1000x1000 photo: not racquet-shaped, so drawn directly.
  const mark = (width: number, height: number) =>
    sharp({ create: { width: 1000, height: 1000, channels: 3, background: "#fff" } })
      .composite([{ input: { create: { width, height, channels: 3, background: "#000" } }, left: 100, top: 100 }])
      .png()
      .toBuffer();
  assert.equal(await toRacquetWebp(await mark(6, 6)), null, "speck");
  assert.equal(await toRacquetWebp(await mark(800, 4)), null, "hairline");
  assert.equal(await toRacquetWebp(await mark(10, 800)), null, "stripe thinner than 20px");
  assert.equal(await toRacquetWebp(await mark(60, 60)), null, "square shorter than 100px");
  // A racquet-shaped thing at the minimum size is accepted (a flat 20x100 block would be refused as one colour).
  const small = await photoPng({ width: 1000, height: 1000, box: { left: 100, top: 100, width: 34, height: 100 }, background: "#fff" });
  assert.ok(await toRacquetWebp(small), "34x100 racquet");
});

test("every accepted format gives a 1000x1500 WebP", async () => {
  // AVIF is read by sharp as format "heif", so it needs its own check.
  for (const format of ["png", "jpeg", "webp", "gif", "avif"] as const) {
    const out = await toRacquetWebp(await racquetImage(300, 900, format));
    assert.ok(out, format);
    const meta = await sharp(out).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ["webp", 1000, 1500], format);
    assertBuiltInFrame(await contentBox(out), format);
  }
});

test("a photo over the 50 megapixel limit is refused before it is decoded", async () => {
  // 7100 x 7100 = 50.4 MP of one colour compresses to a few KB.
  const huge = await sharp({ create: { width: 7100, height: 7100, channels: 3, background: "#fff" } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  assert.equal(await toRacquetWebp(huge), null);
});

test("something that isn't an image, or is cut short, is refused", async () => {
  assert.equal(await toRacquetWebp(Buffer.from("this is not a picture")), null);
  assert.equal(await toRacquetWebp((await racquetImage()).subarray(0, 40)), null);
});
