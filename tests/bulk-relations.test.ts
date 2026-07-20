import assert from "node:assert/strict";
import test from "node:test";
import {
  D1_MAX_BOUND_PARAMETERS,
  MAX_CATEGORY_FILTERS,
  MAX_PRODUCT_IMAGES,
  categoryFiltersInsert,
  productImagesInsert,
} from "../src/lib/admin/bulk-relations.ts";

const ids = (count: number) => Array.from({ length: count }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`);

test("packs thirty product images into one D1 statement", () => {
  const statement = productImagesInsert("product-id", ids(MAX_PRODUCT_IMAGES));
  assert.ok(statement);
  assert.equal(statement.bindings.length, 90);
  assert.ok(statement.bindings.length <= D1_MAX_BOUND_PARAMETERS);
  assert.equal((statement.sql.match(/\(/gu) ?? []).length, MAX_PRODUCT_IMAGES + 1);
});

test("packs fifty category filters into one D1 statement", () => {
  const statement = categoryFiltersInsert("category-id", ids(MAX_CATEGORY_FILTERS));
  assert.ok(statement);
  assert.equal(statement.bindings.length, 100);
  assert.ok(statement.bindings.length <= D1_MAX_BOUND_PARAMETERS);
});

test("rejects relation writes beyond configured limits", () => {
  assert.throws(() => productImagesInsert("product-id", ids(MAX_PRODUCT_IMAGES + 1)), RangeError);
  assert.throws(() => categoryFiltersInsert("category-id", ids(MAX_CATEGORY_FILTERS + 1)), RangeError);
});
