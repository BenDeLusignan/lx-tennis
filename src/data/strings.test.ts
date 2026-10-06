import assert from "node:assert/strict";
import { test } from "node:test";
import { STRING_TYPES as STORED_STRING_TYPES } from "@/db/schema";
import { STRING_TYPES, stringTypeLabel } from "./strings";

// Importing strings.ts pulls in the database module, which only connects
// lazily, so no test database is needed for these pure checks.
test("every stored string type has exactly one label, and each label starts with a capital letter", () => {
  assert.deepEqual(
    STRING_TYPES.map(({ value }) => value),
    [...STORED_STRING_TYPES],
  );
  for (const { value, label } of STRING_TYPES) {
    assert.match(label, /^\p{Lu}/u, `${value}: "${label}" must start with a capital`);
    assert.equal(stringTypeLabel(value), label);
  }
  assert.equal(new Set(STRING_TYPES.map(({ label }) => label)).size, STRING_TYPES.length);
});
