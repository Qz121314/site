import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('catalog cards and filters share one touch-first visual contract', async () => {
  const [theme, home, browse, section] = await Promise.all([
    readFile(new URL('../src/theme-runtime.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/home-feed.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/browse-ui.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/section-ui.css', import.meta.url), 'utf8'),
  ]);

  assert.match(theme, /--catalog-card-shadow:/u);
  assert.match(theme, /--catalog-card-shadow-hover:/u);
  assert.match(theme, /--catalog-card-shadow-pressed:/u);
  assert.match(theme, /--catalog-card-title-weight:/u);

  for (const [styles, coverClass, titleClass] of [
    [home, '.home-product-cover', '.home-product-title'],
    [browse, '.browse-search-product-cover', '.browse-search-product-title'],
    [section, '.section-product-cover', '.section-product-title'],
  ]) {
    assert.match(
      styles,
      new RegExp(`${coverClass.replaceAll('.', '\\.') } \\{[\\s\\S]*box-shadow: var\\(--catalog-card-shadow\\)`, 'u'),
    );
    assert.match(
      styles,
      new RegExp(`${titleClass.replaceAll('.', '\\.') } \\{[\\s\\S]*font-weight: var\\(--catalog-card-title-weight\\)`, 'u'),
    );
  }

  assert.match(
    section,
    /\.section-category-filter button \{[\s\S]*border-radius: 999px/u,
  );
  assert.match(
    section,
    /\.section-category-filter button\.is-active \{[\s\S]*background: var\(--text\)/u,
  );
  assert.match(
    section,
    /\.section-tag-filter button\.is-active \{[\s\S]*var\(--brand\)/u,
  );
  assert.match(section, /\.section-category-filter button:focus-visible/u);
  assert.doesNotMatch(section, /\.section-category-filter button::after/u);
});
