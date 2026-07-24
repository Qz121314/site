import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesheetUrl = new URL("../src/styles/public-desktop-catalog-refinement.css", import.meta.url);

test("PC catalog uses compact navigation rails and a wider shared frame", async () => {
  const source = await readFile(stylesheetUrl, "utf8");

  assert.match(source, /@media \(min-width: 1100px\)/u);
  assert.match(source, /--public-width: 100rem/u);
  assert.match(
    source,
    /grid-template-columns: clamp\(8\.5rem, 9vw, 9rem\) minmax\(0, 1fr\)/u,
  );
  assert.match(
    source,
    /grid-template-columns: clamp\(6\.5rem, 6\.8vw, 7\.25rem\) minmax\(0, 1fr\)/u,
  );
});

test("PC header places search between the brand and legal navigation", async () => {
  const source = await readFile(stylesheetUrl, "utf8");

  assert.match(
    source,
    /grid-template-columns: max-content minmax\(16rem, 27rem\) minmax\(0, 1fr\)/u,
  );
  assert.match(source, /\.public-body \.public-header-trailing \{[\s\S]*grid-column: 2/u);
  assert.match(source, /\.public-body \.public-header-desktop-nav \{[\s\S]*grid-column: 3/u);
});
