import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLIC_API_EDGE_CACHE_SECONDS,
  PUBLIC_EDGE_CACHE_SECONDS,
  publicHtmlEdgeCacheSeconds,
} from "../src/lib/public/cache-policy.ts";

test("keeps every public HTML route in the long-lived edge cache", () => {
  assert.equal(PUBLIC_EDGE_CACHE_SECONDS, 31_536_000);
  assert.equal(publicHtmlEdgeCacheSeconds("/"), PUBLIC_EDGE_CACHE_SECONDS);
  assert.equal(publicHtmlEdgeCacheSeconds("/privacy"), PUBLIC_EDGE_CACHE_SECONDS);
  assert.equal(publicHtmlEdgeCacheSeconds("/channel-one"), PUBLIC_EDGE_CACHE_SECONDS);
  assert.equal(publicHtmlEdgeCacheSeconds("/channel-one/category/category-one"), PUBLIC_EDGE_CACHE_SECONDS);
  assert.equal(publicHtmlEdgeCacheSeconds("/channel-one/product/product-one"), PUBLIC_EDGE_CACHE_SECONDS);
});

test("keeps paginated product API responses until an explicit purge", () => {
  assert.equal(PUBLIC_API_EDGE_CACHE_SECONDS, PUBLIC_EDGE_CACHE_SECONDS);
});
