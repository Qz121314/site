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

test('media center keeps compact cards while preserving original media proportions', () => {
  assert.doesNotMatch(viewSource, /MediaUploadQueuePanel/);
  assert.doesNotMatch(viewSource, /上传队列|队列处理中/);
  assert.doesNotMatch(mainSource, /media-upload-queue\.css|media-center-density\.css/);
  assert.match(viewSource, /<UploadMediaCard item=\{item\}/);
  assert.match(viewSource, /上传 \{uploadQueue\.progress\.done\}/);
  assert.match(cssSource, /minmax\(138px, 156px\)/);
  assert.doesNotMatch(cssSource, /\.media-center-preview\s*\{[^}]*aspect-ratio/s);
  assert.match(
    cssSource,
    /\.media-center-preview img,\n\.media-center-preview video \{[^}]*height: auto;/s,
  );
  assert.doesNotMatch(
    cssSource,
    /\.media-center-preview img,\n\.media-center-preview video \{[^}]*object-fit:/s,
  );
  assert.match(cssSource, /\.media-center-upload-bar > small \{\n  display: none;/);
  assert.doesNotMatch(cssSource, /\.media-center-heading::after/);
});
