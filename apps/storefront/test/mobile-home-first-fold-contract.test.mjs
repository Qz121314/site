import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('mobile home hero leaves room for discovery content in the first fold', async () => {
  const styles = await readFile(new URL('../src/hero-carousel.css', import.meta.url), 'utf8');

  assert.match(
    styles,
    /@media \(max-width: 767px\)[\s\S]*?\.hero-carousel-slide \{[\s\S]*?height: clamp\(300px, 52svh, 440px\);[\s\S]*?min-height: 0;[\s\S]*?aspect-ratio: auto;/u,
  );
  assert.match(
    styles,
    /@media \(max-width: 767px\)[\s\S]*?\.hero-carousel-overlay \{[\s\S]*?padding: 22px/u,
  );
  assert.doesNotMatch(styles, /min-height: clamp\(320px, 64vh, 540px\);/u);
  assert.doesNotMatch(styles, /aspect-ratio: 4 \/ 5;/u);
});
