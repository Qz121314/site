import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("form image selection stays local until the user saves", async () => {
  const [component, uploader, workspace] = await Promise.all([
    readFile(new URL("../src/components/admin/DirectImageUpload.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/admin-direct-image-upload.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/admin-collection-workspace.ts", import.meta.url), "utf8"),
  ]);

  assert.match(component, /import "@\/scripts\/admin-direct-image-upload"/u);
  assert.match(component, /选择多张图片/u);
  assert.match(component, /浏览器压缩 · 保存时上传/u);
  assert.doesNotMatch(component, /\/api\/admin\/images\/upload/u);

  assert.match(uploader, /async function prepareImage/u);
  assert.match(uploader, /URL\.createObjectURL\(original\.blob\)/u);
  assert.match(uploader, /const pendingUploads = new Map/u);
  assert.match(uploader, /data\.pendingUploads|dataset\.pendingUploads/u);
  assert.match(uploader, /form\.addEventListener\("submit"/u);
  assert.match(uploader, /controllers\.map\(\(controller\) => controller\.commit\(\)\)/u);
  assert.match(uploader, /async function uploadPreparedImage/u);
  assert.equal((uploader.match(/fetch\("\/api\/admin\/images\/upload"/gu) ?? []).length, 1);

  const changeHandler = uploader.match(/input\.addEventListener\("change", \(\) => \{([\s\S]*?)\n  \}\);/u)?.[1] ?? "";
  assert.ok(changeHandler, "image input change handler should exist");
  assert.match(changeHandler, /prepareImage\(file, variant\)/u);
  assert.doesNotMatch(changeHandler, /uploadPreparedImage|fetch\(/u);

  assert.match(workspace, /direct-upload:reset/u);
});
