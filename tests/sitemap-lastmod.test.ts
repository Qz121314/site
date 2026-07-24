import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSitemapLastModified } from "../src/lib/public/sitemap";

test("sitemap lastmod normalization accepts D1 and ISO timestamps", () => {
  assert.equal(normalizeSitemapLastModified("2026-07-24 05:00:00"), "2026-07-24T05:00:00.000Z");
  assert.equal(normalizeSitemapLastModified("2026-07-24T05:00:00"), "2026-07-24T05:00:00.000Z");
  assert.equal(normalizeSitemapLastModified("2026-07-24T07:00:00+02:00"), "2026-07-24T05:00:00.000Z");
  assert.equal(normalizeSitemapLastModified("not-a-date"), null);
  assert.equal(normalizeSitemapLastModified(""), null);
});
