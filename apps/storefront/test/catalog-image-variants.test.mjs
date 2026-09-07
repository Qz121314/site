import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('catalog product cards keep responsive media delivery without eager-loading the whole grid', () => {
  const sources = [
    readFileSync(new URL('../src/SectionPage.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('../src/BrowsePage.tsx', import.meta.url), 'utf8'),
  ];

  for (const source of sources) {
    assert.match(source, /publicImageVariantUrl\(product\.coverObjectKey/u);
    assert.match(source, /srcSet=\{srcSet\}/u);
    assert.match(source, /loading=\{index < 2 \? 'eager' : 'lazy'\}/u);
  }
});
