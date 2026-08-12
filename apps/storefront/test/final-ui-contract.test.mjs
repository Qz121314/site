import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mainSource = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const accessibilityCss = await readFile(
  new URL('../src/ui-accessibility.css', import.meta.url),
  'utf8',
);
const mediaLayoutCss = await readFile(
  new URL('../src/media-layout-contract.css', import.meta.url),
  'utf8',
);
const brandCss = await readFile(new URL('../src/brand-bar.css', import.meta.url), 'utf8');
const workerSource = await readFile(
  new URL('../../worker/src/index.ts', import.meta.url),
  'utf8',
);

test('semantic page titles stay screen-reader only so the top bar owns visual branding', () => {
  assert.ok(mainSource.includes("import './ui-accessibility.css';"));
  assert.ok(accessibilityCss.includes('.sr-only'));
  assert.ok(accessibilityCss.includes('clip: rect(0 0 0 0)'));
  assert.ok(brandCss.includes('.app-shell > .site-footer'));
  assert.ok(brandCss.includes('display: none;'));
});

test('primary storefront card media uses a square presentation contract', () => {
  assert.ok(mainSource.includes("import './media-layout-contract.css';"));
  assert.ok(mediaLayoutCss.includes('.app-shell .home-product-cover'));
  assert.ok(mediaLayoutCss.includes('.app-shell .browse-section-card'));
  assert.ok(mediaLayoutCss.includes('.app-shell .section-product-cover'));
  assert.ok(mediaLayoutCss.includes('aspect-ratio: 1 / 1;'));
});

test('/admin without a trailing slash canonicalizes to the admin application', () => {
  assert.ok(workerSource.includes("pathname === '/admin'"));
  assert.ok(workerSource.includes("context.redirect('/admin/', 308)"));
});
