import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const settingsSource = await readFile(
  new URL('../src/SiteSettingsView.tsx', import.meta.url),
  'utf8',
);
const layoutSource = await readFile(
  new URL('../src/HomeLayoutSettingsSection.tsx', import.meta.url),
  'utf8',
);

test('site settings exposes explicit seven-shortcut and three-recommendation Home layout controls', () => {
  assert.match(settingsSource, /<HomeLayoutSettingsSection/u);
  assert.match(layoutSource, /shortcutSectionIds:\s*7/u);
  assert.match(layoutSource, /recommendationSectionIds:\s*3/u);
  assert.match(layoutSource, /第 8 个 More/u);
  assert.match(layoutSource, /首页推荐/u);
});

test('legacy Featured Latest and home section count controls are no longer shown in site settings', () => {
  assert.doesNotMatch(settingsSource, />首页分区数量</u);
  assert.doesNotMatch(settingsSource, /\['showHot', 'Featured'\]/u);
  assert.doesNotMatch(settingsSource, /\['showLatest', 'Latest'\]/u);
});

test('site settings no longer exposes a Storefront Copy editor', () => {
  assert.doesNotMatch(settingsSource, /StorefrontCopySettingsSection/u);
  assert.doesNotMatch(settingsSource, /前端文案/u);
  assert.doesNotMatch(settingsSource, /storefrontCopy/u);
});
