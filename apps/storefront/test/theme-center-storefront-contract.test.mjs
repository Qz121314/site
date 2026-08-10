import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const storefrontMain = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const contentUi = await readFile(new URL('../src/content-ui.css', import.meta.url), 'utf8');
const themeRuntime = await readFile(new URL('../src/theme-runtime.ts', import.meta.url), 'utf8');
const sharedContract = await readFile(
  new URL('../../../packages/storefront-ui/src/theme-contract.css', import.meta.url),
  'utf8',
);
const sharedPackage = JSON.parse(
  await readFile(new URL('../../../packages/storefront-ui/package.json', import.meta.url), 'utf8'),
);
const adminMain = await readFile(new URL('../../admin/src/main.tsx', import.meta.url), 'utf8');
const themeCenterView = await readFile(new URL('../../admin/src/ThemeCenterView.tsx', import.meta.url), 'utf8');

test('storefront runtime consumes Theme Center density', () => {
  assert.match(themeRuntime, /type ThemeDensity = 'compact' \| 'standard' \| 'comfortable';/u);
  assert.match(themeRuntime, /root\.dataset\.density = theme\.density;/u);
  assert.match(themeRuntime, /storefront-theme-v2/u);
});

test('shared theme contract is the final Storefront visual layer', () => {
  const contentUiImport = storefrontMain.indexOf("import './content-ui.css';");
  const themeContract = storefrontMain.indexOf("import '@site/storefront-ui/theme-contract.css';");
  assert.ok(contentUiImport >= 0, 'content UI must be loaded');
  assert.ok(themeContract > contentUiImport, 'theme contract must load after structural content UI');
  assert.equal(
    sharedPackage.exports['./theme-contract.css'],
    './src/theme-contract.css',
    'shared package must export the theme contract',
  );
});

test('Admin Theme Center preview consumes the same shared contract', () => {
  assert.match(adminMain, /@site\/storefront-ui\/theme-contract\.css/u);
  assert.match(themeCenterView, /data-theme=\{selectedPreset\.key\}/u);
  assert.match(themeCenterView, /storefront-theme-root/u);
});

test('official theme recipes and density variants remain visually distinct', () => {
  for (const key of ['marketplace', 'noir', 'live', 'saas', 'travel', 'tech']) {
    assert.match(sharedContract, new RegExp(`data-theme='${key}'`, 'u'));
  }
  assert.match(sharedContract, /data-density='compact'/u);
  assert.match(sharedContract, /data-density='comfortable'/u);
  assert.match(sharedContract, /--theme-radius-card/u);
  assert.match(sharedContract, /--theme-control-height/u);
  assert.match(sharedContract, /--theme-card-background/u);
  assert.match(sharedContract, /--theme-header-background/u);
  assert.match(sharedContract, /--theme-tab-background/u);
});

test('business layout stays structural while Theme Center owns visual tokens', () => {
  assert.match(
    contentUi,
    /\.product-card\s*\{[\s\S]*?grid-template-columns:\s*var\(--theme-desktop-media-size,/u,
  );
  assert.match(
    contentUi,
    /\.product-card-media\s*\{[\s\S]*?border-radius:\s*var\(--theme-radius-media,/u,
  );
  assert.doesNotMatch(sharedContract, /html \.product-card\s*\{/u);
  assert.doesNotMatch(sharedContract, /grid-template-columns:\s*repeat\(3/u);
  assert.doesNotMatch(sharedContract, /grid-template-columns:\s*repeat\(4/u);
});
