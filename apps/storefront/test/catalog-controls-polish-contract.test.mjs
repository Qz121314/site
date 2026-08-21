import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('catalog cards and filters share one touch-first visual contract', async () => {
  const [theme, polish, main] = await Promise.all([
    readFile(new URL('../src/theme-runtime.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/catalog-polish.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(theme, /--catalog-card-shadow:/u);
  assert.match(theme, /--catalog-card-shadow-hover:/u);
  assert.match(theme, /--catalog-card-shadow-pressed:/u);
  assert.match(theme, /--catalog-card-title-weight:/u);
  assert.match(main, /import '\.\/catalog-polish\.css';/u);

  assert.match(polish, /\.home-product-cover/u);
  assert.match(polish, /\.browse-search-product-cover/u);
  assert.match(polish, /\.section-product-cover/u);
  assert.match(polish, /box-shadow: var\(--catalog-card-shadow\)/u);
  assert.match(polish, /font-weight: var\(--catalog-card-title-weight\)/u);
  assert.match(polish, /box-shadow: var\(--catalog-card-shadow-pressed\)/u);

  assert.match(
    polish,
    /\.section-category-filter button \{[\s\S]*border-radius: 999px/u,
  );
  assert.match(
    polish,
    /\.section-category-filter button\.is-active \{[\s\S]*background: var\(--text\)/u,
  );
  assert.match(
    polish,
    /\.section-tag-filter button\.is-active \{[\s\S]*var\(--brand\)/u,
  );
  assert.match(polish, /\.section-category-filter button:focus-visible/u);
  assert.match(
    polish,
    /\.section-category-filter button::after \{[\s\S]*display: none/u,
  );
});
