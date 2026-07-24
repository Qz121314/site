import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public sitemap batches its four D1 reads without changing result groups", async () => {
  const sitemap = await readFile(
    new URL("../src/lib/db/sitemap.ts", import.meta.url),
    "utf8",
  );

  assert.match(sitemap, /env\.DB\.batch<SitemapBatchRow>\(\[/u);
  assert.equal([...sitemap.matchAll(/env\.DB\.prepare\(/gu)].length, 4);
  assert.doesNotMatch(sitemap, /Promise\.all/u);
  assert.match(sitemap, /siteUpdatedAt: site\?\.updatedAt \?\? fallbackUpdatedAt/u);
  assert.match(sitemap, /channels: readBatchRows<ChannelEntry>\(channelResult\)/u);
  assert.match(sitemap, /categories: readBatchRows<CategoryEntry>\(categoryResult\)/u);
  assert.match(sitemap, /products: readBatchRows<ProductEntry>\(productResult\)/u);
});
