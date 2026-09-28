import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNextPath } from "@/auth/safe-next-path";

test("keeps same-origin paths, with their query and hash", () => {
  assert.equal(safeNextPath("/racquets/yonex-ezone-98-2022"), "/racquets/yonex-ezone-98-2022");
  assert.equal(safeNextPath("/racquets?sort=name#top"), "/racquets?sort=name#top");
});

test("sends anything that could leave the site to the home page", () => {
  for (const next of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/.//evil.example",
    "/%2e//evil.example",
    "javascript:alert(1)",
    "evil.example",
    "",
  ]) {
    assert.equal(safeNextPath(next), "/", `next=${JSON.stringify(next)}`);
  }
});

test("ignores a missing or repeated parameter", () => {
  assert.equal(safeNextPath(undefined), "/");
  assert.equal(safeNextPath(["/racquets", "/"]), "/");
});

test("doesn't send a reviewer who just logged in back to the login page", () => {
  assert.equal(safeNextPath("/login"), "/");
  assert.equal(safeNextPath("/login?next=/racquets"), "/");
});
