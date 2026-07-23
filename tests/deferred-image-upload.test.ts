import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("form image selection stays local until the user saves", async () => {
  const [component, uploader, workspace, gallery, uploadApi] = await Promise.all([
    readFile(new URL("../src/components/admin/DirectImageUpload.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/admin-direct-image-upload.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/scripts/admin-collection-workspace.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/ProductGalleryUpload.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/api/admin/images/upload.ts", import.meta.url), "utf8"),
  ]);

  assert.match(component, /import "@\/scripts\/admin-direct-image-upload"/u);
  assert.match(component, /选择多张图片/u);
  assert.match(component, /浏览器压缩 · 保存时上传/u);
  assert.doesNotMatch(component, /\/api\/admin\/images\/upload/u);

  assert.match(uploader, /async function prepareImage/u);
  assert.match(uploader, /PREVIEW_DIMENSION = 480/u);
  assert.match(uploader, /URL\.createObjectURL\(preview\.blob\)/u);
  assert.match(uploader, /本地缩略图 · 待保存/u);
  assert.match(uploader, /const pendingUploads = new Map/u);
  assert.match(uploader, /data\.pendingUploads|dataset\.pendingUploads/u);
  assert.match(uploader, /form\.addEventListener\("submit"/u);
  assert.match(uploader, /const hasWork = controllers\.some/u);
  assert.match(uploader, /controllers\.map\(\(controller\) => controller\.commit\(\)\)/u);
  assert.match(uploader, /async function uploadPreparedImage/u);
  assert.equal((uploader.match(/fetch\("\/api\/admin\/images\/upload"/gu) ?? []).length, 1);

  const changeHandler = uploader.match(/input\.addEventListener\("change", \(\) => \{([\s\S]*?)\n  \}\);/u)?.[1] ?? "";
  assert.ok(changeHandler, "image input change handler should exist");
  assert.match(changeHandler, /prepareImage\(file, variant\)/u);
  assert.match(changeHandler, /generation !== preparationGeneration/u);
  assert.doesNotMatch(changeHandler, /uploadPreparedImage|fetch\(/u);

  assert.match(uploader, /const clearPending = \(\): void => \{[\s\S]*preparationGeneration \+= 1/u);
  assert.match(uploader, /URL\.revokeObjectURL\(pending\.localUrl\)/u);
  assert.match(workspace, /direct-upload:reset/u);

  assert.match(gallery, /item\.dataset\.uploadOrder = String\(index\)/u);
  assert.match(gallery, /field\.dataset\.uploadOrder = String\(index\)/u);
  assert.match(gallery, /values\.appendChild\(field\)/u);

  assert.match(uploadApi, /env\.MEDIA_BUCKET\.put\(objectKey/u);
  assert.match(uploadApi, /INSERT INTO image_assets/u);
  assert.match(uploadApi, /catch \(error\) \{[\s\S]*env\.MEDIA_BUCKET\.delete/u);
});
