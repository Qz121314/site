import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("channel metadata identifies the channel, category, and page", async () => {
  const source = await readFile(
    new URL("../src/pages/[channel]/index.astro", import.meta.url),
    "utf8",
  );

  assert.match(source, /import \{ truncateText \} from "@\/lib\/public\/seo"/u);
  assert.match(source, /Browse \$\{selectedCategory\.name\} in \$\{channel\.name\}/u);
  assert.match(source, /\$\{channel\.name\} recommendations and listings/u);
  assert.match(source, /pageInput\.page > 1 \? ` — page \$\{pageInput\.page\}`/u);
  assert.match(source, /\.filter\(Boolean\)\.join\(" "\), 160\)/u);
  assert.match(source, /description=\{description\}/u);
  assert.doesNotMatch(source, /description=\{pageAvailable && channel \? site\.siteDescription/u);
});
