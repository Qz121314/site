import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('hero active video controls media preload', async () => {
  const source = await readFile(new URL('../src/HomeFeed.tsx', import.meta.url), 'utf8');

  assert.match(source, /autoPlay=\{index === activeIndex\}/u);
  assert.match(source, /preload=\{index === activeIndex \? 'auto' : 'none'\}/u);
  assert.doesNotMatch(source, /preload=\{index === 0 \? 'auto' : 'metadata'\}/u);
});

test('product detail bounds mobile media preload', async () => {
  const source = await readFile(
    new URL('../src/ProductDetailPage.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /Math\.abs\(index - mobileMediaIndex\) <= 1/u);
  assert.match(source, /loading=\{isActiveMedia \? 'eager' : 'lazy'\}/u);
  assert.doesNotMatch(source, /preload="metadata"/u);
  assert.ok((source.match(/preload="none"/gu) ?? []).length >= 4);
});
