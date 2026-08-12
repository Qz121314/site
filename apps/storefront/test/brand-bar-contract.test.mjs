import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mainSource = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const rootSource = await readFile(
  new URL('../src/StorefrontRoot.tsx', import.meta.url),
  'utf8',
);
const brandCss = await readFile(new URL('../src/brand-bar.css', import.meta.url), 'utf8');

test('storefront renders one global brand bar and loads its refinement after app shell CSS', () => {
  assert.equal(rootSource.match(/<StorefrontBrandBar\b/gu)?.length, 1);

  const shellImport = mainSource.indexOf("import './app-shell.css';");
  const brandImport = mainSource.indexOf("import './brand-bar.css';");
  assert.ok(shellImport >= 0, 'app shell CSS must be loaded');
  assert.ok(brandImport > shellImport, 'brand bar refinement must load after app shell CSS');
});

test('global brand bar keeps one visual logo horizontally centered', () => {
  assert.match(
    brandCss,
    /\.app-shell > \.topbar\s*\{[\s\S]*?justify-content:\s*center;/u,
  );
  assert.match(
    brandCss,
    /\.app-shell \.brand-lockup\s*\{[\s\S]*?place-items:\s*center;[\s\S]*?margin-inline:\s*auto;/u,
  );
  assert.match(
    brandCss,
    /\.app-shell \.brand-logo img\s*\{[\s\S]*?object-fit:\s*contain;/u,
  );
  assert.match(
    brandCss,
    /\.brand-lockup > span:last-child:not\(\.brand-logo\)[\s\S]*?position:\s*absolute;[\s\S]*?clip:\s*rect\(0 0 0 0\);/u,
  );
});

test('standard mobile push pages keep the shared logo bar while an open chat remains full-screen', () => {
  assert.match(
    brandCss,
    /html\[data-storefront-presentation='push'\] \.app-shell > \.topbar\s*\{[\s\S]*?display:\s*flex;/u,
  );
  assert.match(
    brandCss,
    /\.app-shell:has\(\.messages-workspace\.is-thread-open\) > \.topbar\s*\{[\s\S]*?display:\s*none;/u,
  );
});
