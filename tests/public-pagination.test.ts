import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_PUBLIC_PRODUCT_PAGE,
  publicPageCanonical,
  publicPageHref,
  readPublicPage,
} from "../src/lib/public/pagination.ts";

test("accepts omitted and valid public product pages", () => {
  assert.deepEqual(readPublicPage(null), { page: 1, valid: true });
  assert.deepEqual(readPublicPage("1"), { page: 1, valid: true });
  assert.deepEqual(readPublicPage(String(MAX_PUBLIC_PRODUCT_PAGE)), {
    page: MAX_PUBLIC_PRODUCT_PAGE,
    valid: true,
  });
});

test("rejects malformed and out-of-range public product pages", () => {
  for (const value of ["0", "-1", "1.5", "abc", ` ${1}`, String(MAX_PUBLIC_PRODUCT_PAGE + 1)]) {
    assert.deepEqual(readPublicPage(value), { page: 1, valid: false });
  }
});

test("builds clean page links without carrying arbitrary query parameters", () => {
  const url = new URL("https://example.com/catalog?utm_source=test&page=8");
  assert.equal(publicPageHref(url, 1), "/catalog");
  assert.equal(publicPageHref(url, 3), "/catalog?page=3");
  assert.equal(publicPageCanonical(url, 3), "https://example.com/catalog?page=3");
});
