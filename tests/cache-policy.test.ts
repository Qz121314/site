import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLIC_API_EDGE_CACHE_SECONDS,
  publicHtmlEdgeCacheSeconds,
} from "../src/lib/public/cache-policy.ts";

test("keeps lightweight entry pages cached longer than catalog detail pages", () => {
  assert.equal(publicHtmlEdgeCacheSeconds("/"), 300);
  assert.equal(publicHtmlEdgeCacheSeconds("/privacy"), 300);
  assert.equal(publicHtmlEdgeCacheSeconds("/channel-one"), 120);
  assert.equal(publicHtmlEdgeCacheSeconds("/channel-one/category/category-one"), 30);
  assert.equal(publicHtmlEdgeCacheSeconds("/channel-one/product/product-one"), 30);
});

test("keeps paginated product API responses fresh", () => {
  assert.equal(PUBLIC_API_EDGE_CACHE_SECONDS, 30);
});
