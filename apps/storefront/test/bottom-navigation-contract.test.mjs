import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const loaderSource = await readFile(new URL('../src/bottom-navigation.ts', import.meta.url), 'utf8');
const navigationSource = await readFile(new URL('../src/storefront-navigation.tsx', import.meta.url), 'utf8');
const copySource = await readFile(new URL('../src/storefront-copy.tsx', import.meta.url), 'utf8');
const cssSource = await readFile(new URL('../src/bottom-navigation.css', import.meta.url), 'utf8');

test('storefront bottom navigation is runtime-configured with safe fallback', () => {
  assert.match(loaderSource, /\/api\/public\/bottom-navigation\//u);
  assert.match(loaderSource, /FALLBACK_BOTTOM_NAVIGATION/u);
  assert.match(copySource, /loadBottomNavigation\(signal\)\.catch\(\(\) => null\)/u);
});

test('bottom navigation supports hide, builtin icons, emoji and image assets', () => {
  assert.match(navigationSource, /\.filter\(\(item\) => item\.enabled\)/u);
  assert.match(navigationSource, /item\.icon\.type === 'emoji'/u);
  assert.match(navigationSource, /item\.icon\.type === 'image'/u);
  assert.match(navigationSource, /case 'compass'/u);
  assert.match(navigationSource, /case 'star'/u);
  assert.match(cssSource, /storefront-nav-image/u);
  assert.match(cssSource, /storefront-nav-emoji/u);
});
