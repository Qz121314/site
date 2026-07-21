import assert from "node:assert/strict";
import test from "node:test";
import { automaticSlug, selectUniqueSlug } from "../src/lib/admin/slug-utils.ts";

test("selects the first available suffix from a fetched slug set", () => {
  assert.equal(selectUniqueSlug("product", 96, ["product", "product-2", "product-3"]), "product-4");
});

test("keeps suffixed slugs within the configured length", () => {
  const base = "a".repeat(64);
  const slug = selectUniqueSlug(base, 64, [base]);
  assert.equal(slug.length, 64);
  assert.ok(slug.endsWith("-2"));
});

test("generates stable non-Latin fallback slugs", () => {
  assert.equal(automaticSlug("产品", "product", 96), automaticSlug("产品", "product", 96));
  assert.match(automaticSlug("产品", "product", 96), /^product-[a-z0-9]+$/u);
});
