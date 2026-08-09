import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootSource = await readFile(new URL('../src/StorefrontRoot.tsx', import.meta.url), 'utf8');
const mainSource = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const adminSettingsSource = await readFile(
  new URL('../../admin/src/SiteSettingsView.tsx', import.meta.url),
  'utf8',
);
const typographyCss = await readFile(
  new URL('../../../packages/storefront-ui/src/typography-contract.css', import.meta.url),
  'utf8',
);
const browseCss = await readFile(new URL('../src/browse-ui.css', import.meta.url), 'utf8');

test('storefront uses a modern self-contained font stack without remote font dependencies', () => {
  assert.match(mainSource, /@site\/storefront-ui\/typography-contract\.css/u);
  assert.match(typographyCss, /Segoe UI Variable Text/u);
  assert.match(typographyCss, /Avenir Next/u);
  assert.doesNotMatch(typographyCss, /https?:\/\//u);
});

test('brand header hides descriptions and only shows a real uploaded logo image', () => {
  assert.match(typographyCss, /\.brand-lockup small[\s\S]*display:\s*none/u);
  assert.match(typographyCss, /\.brand-logo:not\(:has\(img\)\)[\s\S]*display:\s*none/u);
  assert.match(rootSource, /site\.logoUrl \? <ResilientImage alt="" fallback=\{null\}/u);
  assert.doesNotMatch(rootSource, /brand-lettermark/u);
});

test('site description is written to browser metadata instead of visible header copy', () => {
  assert.match(rootSource, /site\.locationLabel\.trim\(\)/u);
  assert.match(rootSource, /meta\[name="description"\]/u);
  assert.match(rootSource, /meta\.content = description/u);
  assert.match(adminSettingsSource, />站点说明</u);
  assert.match(adminSettingsSource, /不显示在前端 Logo \/ Header 区域/u);
});

test('Browse remains the dedicated sticky search surface', () => {
  assert.match(mainSource, /\.\/browse-ui\.css/u);
  assert.match(browseCss, /\.browse-directory-search/u);
  assert.match(browseCss, /position:\s*sticky/u);
  assert.match(browseCss, /\.browse-section-list/u);
});
