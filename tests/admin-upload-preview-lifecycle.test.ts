import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the upload guard does not revoke reusable local preview URLs", async () => {
  const [guard, uploader, adForm] = await Promise.all([
    readFile(new URL("../src/scripts/admin-upload-guard.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/admin-direct-image-upload.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/admin-ad-form.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(guard, /addEventListener\("load"/u);
  assert.doesNotMatch(guard, /revokeObjectURL/u);
  assert.match(uploader, /revokeLocalUrl/u);
  assert.match(uploader, /pagehide[\s\S]*cleanupLocalUrls/u);
  assert.match(adForm, /image\.src = source\.src/u);
});
