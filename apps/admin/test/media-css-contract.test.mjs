import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceDirectory = fileURLToPath(new URL('../src/', import.meta.url));

function readSource(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('media page styles do not rely on forced overrides or legacy aliases', () => {
  const mediaSource = readSource(path.join(sourceDirectory, 'media-center.css'));
  const assetSource = readSource(path.join(sourceDirectory, 'asset-library.css'));
  const assetViewSource = readSource(path.join(sourceDirectory, 'AssetLibraryView.tsx'));

  assert.doesNotMatch(mediaSource, /!important/);
  assert.doesNotMatch(assetSource, /!important/);
  assert.doesNotMatch(
    `${mediaSource}\n${assetViewSource}`,
    /media-center-(?:upload-bar|toolbar)-v2/,
  );
});

test('media and asset controls have one page-level style owner', () => {
  const mediaSelectors = [
    /^\s*\.media-folder-create-bar\b/m,
    /^\s*\.media-center-selection-toolbar\b/m,
    /^\s*\.media-center-upload-bar\b/m,
    /^\s*\.media-center-toolbar\b/m,
  ];
  const cssFiles = fs
    .readdirSync(sourceDirectory)
    .filter((fileName) => fileName.endsWith('.css'));
  for (const fileName of cssFiles) {
    if (fileName === 'media-center.css') continue;
    const cssSource = readSource(path.join(sourceDirectory, fileName));
    for (const selector of mediaSelectors) {
      assert.doesNotMatch(
        cssSource,
        selector,
        `${fileName} must not redefine media center controls`,
      );
    }
  }

  const sharedOverrideSource = ['admin-foundation.css', 'admin-ui-system.css']
    .map((fileName) => readSource(path.join(sourceDirectory, fileName)))
    .join('\n');
  for (const selector of [
    'asset-toolbar',
    'asset-filter-group',
    'asset-empty-state',
    'asset-summary-grid',
  ]) {
    assert.doesNotMatch(sharedOverrideSource, new RegExp(`^\\s*\\.${selector}\\b`, 'm'));
  }
});
