// Must be first: it stands in for next/cache, which strings.ts imports (see the file).
import "@/data/test-database";
import assert from "node:assert/strict";
import { test } from "node:test";
import { capitalizeFirst } from "@/data/strings";

test("capitalizeFirst uppercases only the first letter and leaves the rest exactly as typed", () => {
  assert.equal(capitalizeFirst("hyper-G soft"), "Hyper-G soft");
  assert.equal(capitalizeFirst("polytour pro"), "Polytour pro");
  assert.equal(capitalizeFirst("mach-10"), "Mach-10");
  // Already capitalised, or all capitals: unchanged.
  assert.equal(capitalizeFirst("POLYTOUR PRO"), "POLYTOUR PRO");
  assert.equal(capitalizeFirst("Hyper-G"), "Hyper-G");
  assert.equal(capitalizeFirst("x"), "X");
});

test("capitalizeFirst leaves a leading digit or symbol alone and doesn't reach past it", () => {
  assert.equal(capitalizeFirst("3m tour"), "3m tour");
  assert.equal(capitalizeFirst("(pro) gut"), "(pro) gut");
  assert.equal(capitalizeFirst("-x"), "-x");
  assert.equal(capitalizeFirst(""), "");
});

test("capitalizeFirst handles accented and non-Latin first letters, and astral code points whole", () => {
  assert.equal(capitalizeFirst("école"), "École");
  assert.equal(capitalizeFirst("éCOLE"), "ÉCOLE");
  assert.equal(capitalizeFirst("δοκιμή"), "Δοκιμή");
  // Deseret small letter long I is one code point (two UTF-16 units) with an uppercase form.
  assert.equal(capitalizeFirst("\u{10428}x"), "\u{10400}x");
  // ß would become "SS", changing the spelling: left as typed.
  assert.equal(capitalizeFirst("ßpin"), "ßpin");
});

test("capitalizeFirst is idempotent", () => {
  for (const text of ["hyper-G soft", "école", "3m", "ßpin", "POLYTOUR"]) {
    assert.equal(capitalizeFirst(capitalizeFirst(text)), capitalizeFirst(text), text);
  }
});
