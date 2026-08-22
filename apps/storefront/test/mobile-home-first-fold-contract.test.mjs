import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('mobile home hero leaves room for discovery content in the first fold', async () => {
  const styles = await readFile(new URL('../src/hero-carousel.css', import.meta.url), 'utf8');

  const mobileBlock = styles.match(/@media \(max-width: 767px\) \{([\s\S]*?)\n\}/u)?.[1] ?? '';

  assert.match(mobileBlock, /\.hero-carousel-slide \{[\s\S]*height: clamp\(300px, 52svh, 440px\);/u);
  assert.match(mobileBlock, /min-height: 0;/u);
  assert.match(mobileBlock, /aspect-ratio: auto;/u);
  assert.doesNotMatch(mobileBlock, /64vh/u);
  assert.doesNotMatch(mobileBlock, /aspect-ratio: 4 \/ 5/u);
  assert.match(mobileBlock, /\.hero-carousel-overlay \{[\s\S]*padding: 22px/u);
});
