import assert from "node:assert/strict";
import test from "node:test";
import {
  isConversionAvailabilityConstraintError,
  isProductConversionAvailabilityConstraintError,
} from "../src/lib/admin/pool-integrity.ts";

test("maps conversion availability trigger errors to an in-use condition", () => {
  assert.equal(isConversionAvailabilityConstraintError(new Error("conversion group is used by published products")), true);
  assert.equal(isConversionAvailabilityConstraintError(new Error("published product conversion group requires an enabled resource")), true);
  assert.equal(isConversionAvailabilityConstraintError(new Error("database unavailable")), false);
});

test("maps published product conversion trigger errors", () => {
  assert.equal(
    isProductConversionAvailabilityConstraintError(
      new Error("published product requires an available conversion group"),
    ),
    true,
  );
  assert.equal(isProductConversionAvailabilityConstraintError(new Error("database unavailable")), false);
});
