import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const viewSource = await readFile(
  new URL('../src/AssetLibraryView.tsx', import.meta.url),
  'utf8',
);
const mainSource = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const cssSource = await readFile(
  new URL('../src/media-center.css', import.meta.url),
  'utf8',
);

test('media center renders upload feedback inside a dense asset grid', () => {
  assert.doesNotMatch(viewSource, /MediaUploadQueuePanel/);
  assert.doesNotMatch(viewSource, /上传队列|队列处理中/);
  assert.doesNotMatch(mainSource, /media-upload-queue\.css|media-center-density\.css/);
  assert.match(viewSource, /<UploadMediaCard item=\{item\}/);
  assert.match(viewSource, /上传 \{uploadQueue\.progress\.done\}/);
  assert.match(cssSource, /minmax\(138px, 156px\)/);
  assert.match(cssSource, /aspect-ratio: 4 \/ 3/);
});
