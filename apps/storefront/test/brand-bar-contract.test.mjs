import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mainUrl = new URL('../src/main.tsx', import.meta.url);
const rootUrl = new URL('../src/StorefrontRoot.tsx', import.meta.url);
const cssUrl = new URL('../src/brand-bar.css', import.meta.url);

const mainSource = await readFile(mainUrl, 'utf8');
const rootSource = await readFile(rootUrl, 'utf8');
const brandCss = await readFile(cssUrl, 'utf8');

test('brand bar is global', () => {
  assert.equal(rootSource.match(/<StorefrontBrandBar\b/gu)?.length, 1);
  assert.ok(mainSource.includes("import './brand-bar.css';"));
});

test('logo is centered', () => {
  assert.ok(brandCss.includes('justify-content: center;'));
  assert.ok(brandCss.includes('place-items: center;'));
  assert.ok(brandCss.includes('margin-inline: auto;'));
  assert.ok(brandCss.includes('object-fit: contain;'));
});

test('push pages keep the logo bar', () => {
  assert.ok(brandCss.includes("data-storefront-presentation='push'"));
  assert.ok(brandCss.includes('display: flex;'));
  assert.ok(brandCss.includes('messages-workspace.is-thread-open'));
  assert.ok(brandCss.includes('display: none;'));
});
