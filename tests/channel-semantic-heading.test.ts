import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("channel pages expose their canonical page title as the primary heading", async () => {
  const [page, heading] = await Promise.all([
    readFile(new URL("../src/pages/[channel]/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/components/public/SemanticPageHeading.astro", import.meta.url), "utf8"),
  ]);

  assert.match(page, /import SemanticPageHeading/u);
  assert.match(page, /<SemanticPageHeading text=\{pageTitle\} \/>/u);
  assert.match(heading, /<h1 class="semantic-page-heading">\{text\}<\/h1>/u);
  assert.match(heading, /position: absolute[\s\S]*width: 1px[\s\S]*overflow: hidden/u);
});
