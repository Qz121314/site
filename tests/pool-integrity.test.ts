import assert from "node:assert/strict";
import test from "node:test";
import {
  adPoolIntegrityErrorCode,
  isConversionAvailabilityConstraintError,
} from "../src/lib/admin/pool-integrity.ts";

test("maps conversion availability trigger errors to an in-use condition", () => {
  assert.equal(isConversionAvailabilityConstraintError(new Error("conversion group is used by published products")), true);
  assert.equal(isConversionAvailabilityConstraintError(new Error("published product conversion group requires an enabled resource")), true);
  assert.equal(isConversionAvailabilityConstraintError(new Error("database unavailable")), false);
});

test("maps Hero pool trigger errors to stable admin error codes", () => {
  assert.equal(adPoolIntegrityErrorCode(new Error("bound hero ad pool cannot be disabled")), "in-use");
  assert.equal(adPoolIntegrityErrorCode(new Error("bound hero ad pool requires an enabled advertisement")), "in-use");
  assert.equal(adPoolIntegrityErrorCode(new Error("hero ad pool must be enabled and contain an enabled ad")), "unavailable");
  assert.equal(adPoolIntegrityErrorCode(new Error("database unavailable")), null);
});
