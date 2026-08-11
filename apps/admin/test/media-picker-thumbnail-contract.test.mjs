import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pickerSource = await readFile(
  new URL('../src/asset-library/MediaLibraryPickerDialog.tsx', import.meta.url),
  'utf8',
);
const pickerCss = await readFile(
  new URL('../src/media-picker.css', import.meta.url),
  'utf8',
);
const brandingApi = await readFile(
  new URL('../src/branding-media/api.ts', import.meta.url),
  'utf8',
);
const editorMediaSource = await readFile(
  new URL('../src/product-management/product-editor-media.ts', import.meta.url),
  'utf8',
);
const mediaCenterSource = await readFile(
  new URL('../src/AssetLibraryView.tsx', import.meta.url),
  'utf8',
);

test('admin media selection uses dense thumbnails instead of original media', () => {
  assert.match(brandingApi, /\/assets\/\$\{encodeURIComponent\(assetId\)\}\/thumbnail/);
  assert.match(pickerSource, /brandingAssetPreviewUrl\(asset\.id\)/);
  assert.doesNotMatch(pickerSource, /<video/);
  assert.match(pickerCss, /minmax\(112px, 1fr\)/);
  assert.match(pickerCss, /object-fit: contain/);
  assert.doesNotMatch(pickerCss, /object-fit: cover/);
  assert.match(editorMediaSource, /adminMediaThumbnailUrl\(image\.media\.id\)/);
  assert.match(editorMediaSource, /if \(isEditorMediaVideo\(image\)\) return null/);
  assert.match(mediaCenterSource, /src=\{adminMediaThumbnailUrl\(asset\.id\)\}/);
  assert.doesNotMatch(mediaCenterSource, /<video[^>]*asset\.publicUrl/);
  assert.match(mediaCenterSource, /navigator\.clipboard\.writeText\(asset\.publicUrl/);
});
