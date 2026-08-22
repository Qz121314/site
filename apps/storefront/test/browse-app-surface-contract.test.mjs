import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/BrowsePage.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/browse-ui.css', import.meta.url), 'utf8');

test('browse keeps the first mobile viewport dense without adding initial product requests', () => {
  assert.match(source, /enabled: normalizedSearch\.length > 0/u);
  assert.match(source, /filteredSections\.map\(\(section, index\) =>/u);
  assert.match(source, /fetchPriority=\{index === 0 \? 'high' : 'auto'\}/u);
  assert.match(source, /loading=\{index === 0 \? 'eager' : 'lazy'\}/u);

  assert.match(
    css,
    /\.browse-section-list\.is-single\s+\.browse-section-card \{[\s\S]*min-height: clamp\(250px, 46svh, 360px\);/u,
  );
  assert.match(
    css,
    /\.browse-section-list:not\(\.is-single\) \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/u,
  );
  assert.match(
    css,
    /\.browse-section-list:not\(\.is-single\)\s+\.browse-section-card:first-child \{[\s\S]*grid-column: 1 \/ -1;/u,
  );
  assert.match(
    css,
    /\.browse-section-list:not\(\.is-single\)\s+\.browse-section-card:nth-child\(even\):last-child \{[\s\S]*grid-column: 1 \/ -1;/u,
  );
  assert.match(css, /\.browse-directory-search \{[\s\S]*position: sticky;/u);
});
