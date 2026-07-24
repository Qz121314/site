import assert from "node:assert/strict";
import test from "node:test";
import { plainTextFromHtml } from "../src/lib/public/seo";

test("SEO text extraction tolerates invalid numeric entities", () => {
  assert.equal(plainTextFromHtml("<p>Valid &#x1f642; entity</p>"), "Valid 🙂 entity");
  assert.equal(plainTextFromHtml("<p>Too large &#99999999; entity</p>"), "Too large &#99999999; entity");
  assert.equal(plainTextFromHtml("<p>Surrogate &#xD800; entity</p>"), "Surrogate &#xD800; entity");
});
