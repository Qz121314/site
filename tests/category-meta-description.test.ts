import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("category metadata identifies its channel and page", async () => {
  const source = await readFile(
    new URL("../src/pages/[channel]/category/[category].astro", import.meta.url),
    "utf8",
  );

  assert.match(source, /import \{ truncateText \} from "@\/lib\/public\/seo"/u);
  assert.match(source, /`\$\{category\.name\} — \$\{channel\.name\}\$\{pageInput\.page > 1/u);
  assert.match(source, /Browse \$\{category\.name\} in \$\{channel\.name\}/u);
  assert.match(source, /\.filter\(Boolean\)\.join\(" "\), 160\)/u);
  assert.match(source, /title=\{pageTitle\}/u);
  assert.match(source, /description=\{description\}/u);
});
