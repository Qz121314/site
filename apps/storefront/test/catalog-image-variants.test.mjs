import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('catalog and browse product cards request responsive R2 image variants', () => {
  const section = source('../src/SectionPage.tsx');
  const browse = source('../src/BrowsePage.tsx');

  for (const value of [section, browse]) {
    assert.ok(value.includes('publicImageVariantUrl(product.coverObjectKey, 640)'));
    assert.ok(value.includes('[384, 640, 960]'));
    assert.ok(value.includes('srcSet={srcSet}'));
    assert.ok(value.includes('sizes="(max-width: 767px) 46vw, 372px"'));
  }
  assert.ok(section.includes("loading={index < 2 ? 'eager' : 'lazy'}"));
  assert.ok(browse.includes("loading={index < 2 ? 'eager' : 'lazy'}"));
});
