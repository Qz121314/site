import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/LandingPagesView.tsx', import.meta.url),
  'utf8',
);

test('Landing Admin editor exposes the publish and link handoff', () => {
  assert.match(source, /publishLanding\(saved\.id\)/u);
  assert.match(source, /保存并发布/u);
  assert.match(source, /\/l\/\$\{saved\.slug\}\//u);
  assert.match(source, /复制链接/u);
  assert.match(source, /role="alert"/u);
});

test('Landing Admin editor uses the existing asset picker for Hero overrides', () => {
  assert.match(source, /MediaLibraryPickerDialog/u);
  assert.match(source, /allowedKinds=\{\['image'\]\}/u);
  assert.match(source, /heroAssetId: null/u);
});
