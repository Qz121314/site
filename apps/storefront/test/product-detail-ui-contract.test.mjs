import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mainSource = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const detailCss = await readFile(new URL('../src/product-detail-ui.css', import.meta.url), 'utf8');
const detailThemeCss = await readFile(
  new URL('../../../packages/storefront-ui/src/product-detail-theme-contract.css', import.meta.url),
  'utf8',
);
const sharedPackage = JSON.parse(
  await readFile(new URL('../../../packages/storefront-ui/package.json', import.meta.url), 'utf8'),
);
const adminMain = await readFile(new URL('../../admin/src/main.tsx', import.meta.url), 'utf8');

test('product detail structure loads before Theme Center visual recipes', () => {
  const detailUi = mainSource.indexOf("import './product-detail-ui.css';");
  const sharedTheme = mainSource.indexOf("import '@site/storefront-ui/theme-contract.css';");
  const detailTheme = mainSource.indexOf("import '@site/storefront-ui/product-detail-theme-contract.css';");
  assert.ok(detailUi >= 0, 'product detail structural styles must load');
  assert.ok(sharedTheme > detailUi, 'shared Theme Center contract must load after detail structure');
  assert.ok(detailTheme > sharedTheme, 'detail Theme Center extension must be the final detail visual layer');
});

test('product gallery is touch-first and supports both images and videos', () => {
  assert.match(detailCss, /scroll-snap-type:\s*x mandatory/u);
  assert.match(detailCss, /scrollbar-width:\s*none/u);
  assert.match(detailCss, /\.detail-gallery > img,[\s\S]*?\.detail-gallery > video/u);
  assert.match(detailCss, /aspect-ratio:\s*var\(--theme-detail-media-ratio/u);
  assert.match(detailCss, /\.detail-gallery > video\s*\{[\s\S]*?object-fit:\s*contain/u);
});

test('mobile CTA remains an app action bar above primary navigation', () => {
  assert.match(detailCss, /\.mobile-cta-bar\s*\{[\s\S]*?position:\s*fixed/u);
  assert.match(detailCss, /bottom:\s*calc\(67px \+ env\(safe-area-inset-bottom\)\)/u);
  assert.match(detailCss, /backdrop-filter:\s*blur\(18px\)/u);
  assert.match(detailCss, /\.product-detail:has\(\.mobile-cta-bar\)/u);
});

test('Theme Center owns product detail visual treatment for every official theme', () => {
  for (const key of ['marketplace', 'noir', 'live', 'saas', 'travel', 'tech']) {
    assert.match(detailThemeCss, new RegExp(`data-theme='${key}'`, 'u'));
  }
  assert.match(detailThemeCss, /data-density='compact'/u);
  assert.match(detailThemeCss, /data-density='comfortable'/u);
  assert.match(detailThemeCss, /--theme-detail-panel-background/u);
  assert.match(detailThemeCss, /--theme-detail-media-radius/u);
  assert.match(detailThemeCss, /--theme-detail-cta-surface/u);
});

test('shared package and Admin preview load the product detail Theme Center extension', () => {
  assert.equal(
    sharedPackage.exports['./product-detail-theme-contract.css'],
    './src/product-detail-theme-contract.css',
  );
  assert.match(adminMain, /@site\/storefront-ui\/product-detail-theme-contract\.css/u);
});

test('product detail keeps published CTA destination authoritative', () => {
  assert.match(appSource, /href=\{query\.data\.product\.cta\.path\}/u);
  assert.match(appSource, /\{query\.data\.product\.cta\.label\}/u);
});
