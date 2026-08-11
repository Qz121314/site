import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const loaderSource = await readFile(
  new URL('../src/bottom-navigation.ts', import.meta.url),
  'utf8',
);
const navigationSource = await readFile(
  new URL('../src/storefront-navigation.tsx', import.meta.url),
  'utf8',
);
const rootSource = await readFile(
  new URL('../src/StorefrontRoot.tsx', import.meta.url),
  'utf8',
);
const cssSource = await readFile(
  new URL('../src/bottom-navigation.css', import.meta.url),
  'utf8',
);

test('storefront bottom navigation is runtime-configured and required by the app shell', () => {
  assert.match(loaderSource, /\/api\/public\/bottom-navigation\//u);
  assert.doesNotMatch(loaderSource, /FALLBACK_BOTTOM_NAVIGATION/u);
  assert.match(rootSource, /loadBottomNavigation\(signal\)/u);
  assert.doesNotMatch(rootSource, /navigationQuery\.data \?\? \[\]/u);
  assert.match(
    rootSource,
    /navigationQuery\.error[\s\S]*?!navigationQuery\.data/u,
  );
  assert.match(rootSource, /navigationItems\.length > 0/u);
});

test('bottom navigation supports hide, builtin icons, emoji and image assets', () => {
  assert.match(navigationSource, /\.filter\(\(item\) => item\.enabled\)/u);
  assert.match(navigationSource, /label:\s*item\.label/u);
  assert.match(navigationSource, /item\.icon\.type === 'emoji'/u);
  assert.match(navigationSource, /item\.icon\.type === 'image'/u);
  assert.match(navigationSource, /<ResilientImage/u);
  assert.match(navigationSource, /case 'compass'/u);
  assert.match(navigationSource, /case 'star'/u);
  assert.match(cssSource, /storefront-nav-image/u);
  assert.match(cssSource, /storefront-nav-emoji/u);
});
