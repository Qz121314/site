import assert from "node:assert/strict";
import test from "node:test";
import { plainTextFromHtml, productDescription, truncateText } from "../src/lib/public/seo.ts";

test("plainTextFromHtml removes markup and decodes common entities", () => {
  assert.equal(
    plainTextFromHtml("<p>Premium &amp; discreet</p><script>ignore()</script><p>Updated&nbsp;today.</p>"),
    "Premium & discreet Updated today.",
  );
});

test("truncateText keeps a readable word boundary", () => {
  assert.equal(truncateText("One two three four five six", 18), "One two three four…");
});

test("productDescription prefers body copy and falls back to metadata", () => {
  assert.equal(productDescription({
    title: "Example",
    bodyHtml: "<p>A focused product description with useful details.</p>",
    tags: ["One", "Two"],
    siteDescription: "Visual recommendations.",
  }), "A focused product description with useful details.");

  assert.equal(productDescription({
    title: "Example",
    bodyHtml: "",
    tags: ["One", "Two"],
    siteDescription: "Visual recommendations.",
  }), "Example — One, Two — Visual recommendations.");
});
