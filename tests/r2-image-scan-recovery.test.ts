import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("R2 image scans restore upload identities and responsive derivatives", async () => {
  const [scan, upload] = await Promise.all([
    readFile(new URL("../src/pages/api/admin/images/scan.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/api/admin/images/upload.ts", import.meta.url), "utf8"),
  ]);

  assert.match(upload, /assetId: id/u);
  assert.match(upload, /variant: "original"/u);
  assert.match(upload, /"directory-thumbnail"/u);
  assert.match(upload, /"site-logo"/u);
  assert.match(upload, /"site-favicon"/u);

  assert.match(scan, /const ASSET_ID_PATTERN/u);
  assert.match(scan, /RESTORABLE_DERIVATIVE_VARIANTS/u);
  assert.match(scan, /const id = metadataAssetId \?\? crypto\.randomUUID\(\)/u);
  assert.match(scan, /knownIds\.add\(id\)/u);
  assert.match(scan, /SET thumbnail_object_key = \?2/u);
  assert.match(scan, /thumbnail_width = \?3/u);
  assert.match(scan, /thumbnail_height = \?4/u);
  assert.match(scan, /thumbnail_size_bytes = \?5/u);
  assert.match(scan, /AND thumbnail_object_key IS NULL/u);
  assert.match(scan, /\.\.\.groups\.map\(importStatement\),[\s\S]*\.\.\.thumbnails\.map\(thumbnailStatement\)/u);
  assert.doesNotMatch(scan, /\["directory-thumbnail", "hero-responsive", "site-logo", "site-favicon"\]\.includes/u);
});
