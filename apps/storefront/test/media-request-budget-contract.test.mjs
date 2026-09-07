import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('hero video media work stays limited to the active visible slide', async () => {
  const [homeSource, sharedSource] = await Promise.all([
    readFile(new URL('../src/HomeFeed.tsx', import.meta.url), 'utf8'),
    readFile(
      new URL('../../../packages/storefront-ui/src/index.tsx', import.meta.url),
      'utf8',
    ),
  ]);

  assert.match(homeSource, /autoPlay=\{index === 0\}/u);
  assert.match(homeSource, /preload=\{index === 0 \? 'auto' : 'none'\}/u);
  assert.match(sharedSource, /index === activeIndex && pageVisible/u);
  assert.match(sharedSource, /video\.play\(\)/u);
  assert.match(sharedSource, /video\.pause\(\)/u);
});

test('home reserves eager image work for the primary LCP candidate', async () => {
  const [home, navigation] = await Promise.all([
    readFile(new URL('../src/HomeFeed.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/storefront-navigation.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(home, /fetchPriority=\{index === 0 \? 'high' : 'low'\}/u);
  assert.match(home, /loading=\{index === 0 \? 'eager' : 'lazy'\}/u);
  assert.match(home, /homeProductImageVariantUrl\(product\.coverObjectKey/u);
  assert.match(navigation, /fetchPriority="low"/u);
});

test('product detail eagerly loads one primary media item and defers the rest', async () => {
  const source = await readFile(
    new URL('../src/ProductDetailPage.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /renderMobileMedia\(item, index === 0\)/u);
  assert.match(source, /loading=\{eager \? 'eager' : 'lazy'\}/u);
  assert.match(source, /preload="none"/u);
});
