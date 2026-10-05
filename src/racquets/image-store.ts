import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

/**
 * Where an added racquet's photo is kept. The site is on Vercel, which has
 * no permanent disk, so the photo goes to Vercel Blob (a public store; its
 * token is `BLOB_READ_WRITE_TOKEN`).
 *
 * Local development without a token must still work offline, so there the
 * photo is written under `public/images/racquets/uploads/` (gitignored) and
 * served by Next like any other public file. That fallback is for
 * `next dev` only: any other run (a production server, `npm run start`
 * included) with no token refuses to save rather than quietly writing
 * somewhere that won't survive or won't be served.
 */

/** What the Server Actions need from the store. */
export interface ImageStore {
  /** Stores the WebP and returns the `src` the page will use (an absolute URL or a path under /public). */
  save(slug: string, webp: Buffer): Promise<string>;
  /**
   * Removes a photo this store saved: when the racquet row couldn't be saved
   * after it, when an edit replaced it, or when its racquet was deleted.
   * Anything else (the four built-in racquets' files in
   * `public/images/racquets/`, a path or URL the store didn't make) is left
   * alone and no error is raised: the caller passes whatever the row held.
   */
  remove(src: string): Promise<void>;
}

/**
 * Whether `src` is a Vercel Blob URL, the only thing the Blob store deletes.
 * Public Blob stores serve from `<store-id>.public.blob.vercel-storage.com`.
 * Checked rather than passed to `del()` blindly, which would take a built-in
 * racquet's `/images/...` path as a Blob pathname.
 */
export function isBlobImageUrl(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === "https:" && url.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

const LOCAL_URL_PREFIX = "/images/racquets/uploads/";
const LOCAL_DIR = path.join(process.cwd(), "public", "images", "racquets", "uploads");

const blobStore: ImageStore = {
  async save(slug, webp) {
    // A random suffix makes every upload a new URL, so a failed save's
    // cleanup can only ever delete its own file, never another racquet's.
    const blob = await put(`racquets/${slug}.webp`, webp, {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: true,
    });
    return blob.url;
  },
  async remove(src) {
    if (!isBlobImageUrl(src)) return;
    await del(src);
  },
};

const localStore: ImageStore = {
  async save(slug, webp) {
    const file = `${slug}-${randomBytes(6).toString("hex")}.webp`;
    await mkdir(LOCAL_DIR, { recursive: true });
    await writeFile(path.join(LOCAL_DIR, file), webp);
    return `${LOCAL_URL_PREFIX}${file}`;
  },
  async remove(src) {
    // Only our own files: the name is checked, never taken as a path.
    if (!src.startsWith(LOCAL_URL_PREFIX)) return;
    const file = src.slice(LOCAL_URL_PREFIX.length);
    if (!/^[a-z0-9-]+\.webp$/.test(file)) return;
    await unlink(path.join(LOCAL_DIR, file)).catch(() => {});
  },
};

const unavailableStore: ImageStore = {
  async save() {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  },
  async remove() {},
};

/** The store for this environment. Read per call, so tests and `next dev` pick up env changes. */
export function getImageStore(): ImageStore {
  if (process.env.BLOB_READ_WRITE_TOKEN) return blobStore;
  return process.env.NODE_ENV === "development" ? localStore : unavailableStore;
}
