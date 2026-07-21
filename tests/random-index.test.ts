import assert from "node:assert/strict";
import test from "node:test";
import { secureRandomIndex } from "../src/lib/public/random-index.ts";

test("secure random indexes always stay within the requested range", () => {
  for (const length of [1, 2, 3, 7, 31, 0x1_0000_0000]) {
    for (let attempt = 0; attempt < (length === 0x1_0000_0000 ? 5 : 200); attempt += 1) {
      const index = secureRandomIndex(length);
      assert.ok(Number.isInteger(index));
      assert.ok(index >= 0 && index < length);
    }
  }
});

test("secure random indexes reject invalid ranges", () => {
  for (const value of [
    0,
    -1,
    1.5,
    0x1_0000_0001,
    Number.MAX_SAFE_INTEGER,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ]) {
    assert.throws(() => secureRandomIndex(value), RangeError);
  }
});
