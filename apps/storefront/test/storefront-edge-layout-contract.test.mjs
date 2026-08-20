import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('storefront edge layout contract is wired', () => {
  const main = source('../src/main.tsx');
  const css = source('../src/storefront-edge-layout.css');

  assert.ok(main.includes("import './storefront-edge-layout.css';"));
  assert.ok(!css.includes('body {\n  overflow-x: clip;'));
  assert.ok(css.includes('.hero-carousel-copy h1'));
  assert.ok(css.includes('-webkit-line-clamp: 3;'));
  assert.ok(css.includes('.bottom-nav small'));
  assert.ok(css.includes('text-overflow: ellipsis;'));
  assert.ok(css.includes('.markdown-content pre'));
  assert.ok(css.includes('overflow-x: auto;'));
  assert.ok(css.includes('overscroll-behavior-inline: contain;'));
  assert.ok(css.includes('.detail-mobile-media-stage > .detail-media-fallback'));
  assert.ok(css.includes('--theme-detail-media-ratio'));
  assert.ok(css.includes('.pwa-install-copy span'));
  assert.ok(css.includes('-webkit-line-clamp: 2;'));
  assert.ok(css.includes('env(safe-area-inset-right)'));
  assert.ok(css.includes('env(safe-area-inset-left)'));
});
