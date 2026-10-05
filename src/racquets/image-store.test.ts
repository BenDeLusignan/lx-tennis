// Must be first: it sets up the test database and stands in for next/cache (see the file).
import "@/data/test-database";
import assert from "node:assert/strict";
import { access, rm } from "node:fs/promises";
import path from "node:path";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import { getRacquet } from "@/data/racquets";
import type { Reviewer } from "@/data/reviewers";
import { getDb } from "@/db/client";
import { racquet } from "@/db/schema";
import { getImageStore, isBlobImageUrl } from "@/racquets/image-store";
import { racquetImage as image } from "@/racquets/racquet-fixtures";
import { racquetModel } from "@/racquets/racquet-form";
import { submitRacquetDelete, submitRacquetUpdate } from "@/racquets/submit";

// Seeded on a fresh database: reviewers 1–3, racquets 1–4 (no setups).
const BEN: Reviewer = { id: 1, username: "ben", displayName: "Ben" };
const DELETED = "/account/racquets?deleted=1";

test("only photos the store saved are deleted: Blob URLs and local uploads, never a built-in's file", () => {
  assert.equal(isBlobImageUrl("https://abc123.public.blob.vercel-storage.com/racquets/x-1.webp"), true);
  assert.equal(isBlobImageUrl("/images/racquets/yonex-ezone-98-2022.webp"), false);
  assert.equal(isBlobImageUrl("http://abc123.public.blob.vercel-storage.com/x.webp"), false);
  assert.equal(isBlobImageUrl("https://evil.example/blob.vercel-storage.com/x.webp"), false);
  assert.equal(isBlobImageUrl("https://blob.vercel-storage.com.evil.example/x.webp"), false);
  assert.equal(isBlobImageUrl(""), false);
});

// The real (local, development) store, end to end: a built-in's photo is
// replaced, and then the racquet is deleted, without its shipped file ever
// being touched; our own uploads are removed. It writes under
// public/images/racquets/uploads and deletes two built-in racquets from this
// file's own database.
const fileFor = (src: string) => path.join(process.cwd(), "public", ...src.split("/").filter(Boolean));
const exists = (file: string) => access(file).then(() => true, () => false);
const uploadedFiles: string[] = [];

after(async () => {
  await Promise.all(uploadedFiles.map((file) => rm(file, { force: true })));
});

/** The edit form for a racquet with a new photo, everything else as it is. */
async function newPhotoForm(slug: string, file: Buffer): Promise<FormData> {
  const current = await getRacquet(slug);
  assert.ok(current);
  const data = new FormData();
  data.set("slug", slug);
  data.set("brand", current.brand);
  data.set("model", racquetModel(current));
  data.set("year", String(current.year));
  data.set("image", new File([new Uint8Array(file)], "racquet.png", { type: "image/png" }));
  return data;
}

async function rowExists(slug: string): Promise<boolean> {
  const rows = await getDb().select({ id: racquet.id }).from(racquet).where(eq(racquet.slug, slug));
  return rows.length > 0;
}

test("the real store never deletes a built-in racquet's file, on a photo replace or a delete", async () => {
  const env = process.env as Record<string, string | undefined>;
  const saved = { node: env.NODE_ENV, token: env.BLOB_READ_WRITE_TOKEN };
  env.NODE_ENV = "development";
  delete env.BLOB_READ_WRITE_TOKEN;
  try {
    const real = getImageStore();
    const vcore = "yonex-vcore-98-2023";
    const vcoreFile = fileFor((await getRacquet(vcore))!.image.src);
    assert.ok(await exists(vcoreFile), "the shipped photo is there to start with");

    // First replace: the built-in file is the "old photo", and must survive.
    await submitRacquetUpdate(BEN, await newPhotoForm(vcore, await image()), real);
    const first = (await getRacquet(vcore))!.image.src;
    assert.ok(first.startsWith("/images/racquets/uploads/"), first);
    uploadedFiles.push(fileFor(first));
    assert.ok(await exists(vcoreFile), "the built-in file was not deleted by a replace");
    assert.ok(await exists(fileFor(first)));

    // Second replace: our own upload is the old photo, and is removed.
    await submitRacquetUpdate(BEN, await newPhotoForm(vcore, await image(500, 300, "jpeg")), real);
    const second = (await getRacquet(vcore))!.image.src;
    uploadedFiles.push(fileFor(second));
    assert.notEqual(second, first);
    assert.equal(await exists(fileFor(first)), false, "the replaced upload was removed");
    assert.ok(await exists(fileFor(second)));

    // Deleting a racquet whose photo is still a built-in's file leaves that file alone.
    const percept = "yonex-percept-97-2023";
    const perceptFile = fileFor((await getRacquet(percept))!.image.src);
    assert.ok(await exists(perceptFile));
    const slugOnly = (slug: string) => {
      const data = new FormData();
      data.set("slug", slug);
      return data;
    };
    assert.equal(await submitRacquetDelete(BEN, slugOnly(percept), real), DELETED);
    assert.equal(await rowExists(percept), false);
    assert.ok(await exists(perceptFile), "the built-in file was not deleted by a delete");

    // Deleting one with an upload removes the upload.
    assert.equal(await submitRacquetDelete(BEN, slugOnly(vcore), real), DELETED);
    assert.equal(await exists(fileFor(second)), false);
  } finally {
    if (saved.node === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = saved.node;
    if (saved.token !== undefined) env.BLOB_READ_WRITE_TOKEN = saved.token;
  }
});
