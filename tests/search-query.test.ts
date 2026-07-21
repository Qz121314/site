import assert from "node:assert/strict";
import test from "node:test";
import { normalizePublicSearchQuery } from "../src/lib/search/query.ts";

test("trims public search queries", () => {
  assert.equal(normalizePublicSearchQuery("  camera  "), "camera");
});

test("limits public search queries by UTF-8 bytes", () => {
  const value = "产".repeat(20);
  const normalized = normalizePublicSearchQuery(value);
  assert.equal(normalized, "产".repeat(16));
  assert.equal(new TextEncoder().encode(normalized).byteLength, 48);
});
