import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('home recommendations stay on a single horizontal product rail', async () => {
  const [polishStyles, entry] = await Promise.all([
    readFile(new URL('../src/catalog-polish.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.tsx', import.meta.url), 'utf8'),
  ]);

  const homeStylesImport = entry.indexOf("import '@site/storefront-ui/home.css';");
  const polishStylesImport = entry.indexOf("import './catalog-polish.css';");

  assert.ok(homeStylesImport >= 0);
  assert.ok(polishStylesImport > homeStylesImport);
  assert.match(
    polishStyles,
    /:is\(html, \.storefront-theme-root\) \.home-product-rail \{[\s\S]*?display: flex;[\s\S]*?overflow-x: auto;[\s\S]*?scroll-snap-type: x proximity;[\s\S]*?scrollbar-width: none;/u,
  );
  assert.match(
    polishStyles,
    /:is\(html, \.storefront-theme-root\)[\s\S]*?:is\(\.home-product-tile, \.home-product-skeleton\) \{[\s\S]*?flex: 0 0 clamp\(136px, calc\(\(100% - 68px\) \/ 2\), 164px\);[\s\S]*?scroll-snap-align: start;/u,
  );
  assert.match(
    polishStyles,
    /\.home-product-rail::-webkit-scrollbar \{[\s\S]*?display: none;/u,
  );
});
