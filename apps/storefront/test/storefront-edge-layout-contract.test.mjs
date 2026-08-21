import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('storefront edge safeguards live with their visual owners', () => {
  const main = source('../src/main.tsx');
  const base = source('../src/styles.css');
  const hero = source('../src/hero-carousel.css');
  const pwa = source('../src/pwa.css');
  const detailUi = source('../src/product-detail-ui.css');
  const detailFlow = source('../src/product-detail-content-flow.css');

  assert.ok(!main.includes("import './storefront-edge-layout.css';"));
  assert.ok(!main.includes("import './storefront-resilience.css';"));

  assert.ok(base.includes('.state-actions'));
  assert.ok(base.includes('.secondary-button'));
  assert.ok(base.includes('.markdown-image-fallback'));
  assert.ok(base.includes('.markdown-content pre'));
  assert.ok(base.includes('overscroll-behavior-inline: contain;'));

  assert.ok(hero.includes('.hero-carousel-copy :is(h1, h2)'));
  assert.ok(hero.includes('-webkit-line-clamp: 3;'));

  assert.ok(pwa.includes('.pwa-install-copy span'));
  assert.ok(pwa.includes('-webkit-line-clamp: 2;'));
  assert.ok(pwa.includes('env(safe-area-inset-right)'));
  assert.ok(pwa.includes('env(safe-area-inset-left)'));

  assert.ok(detailUi.includes('.product-detail-summary h1'));
  assert.ok(detailUi.includes('.product-detail-address span'));
  assert.ok(detailUi.includes('overflow-wrap: anywhere;'));
  assert.ok(detailFlow.includes('.detail-mobile-media-stage > .detail-media-fallback'));
  assert.ok(detailFlow.includes('--theme-detail-media-ratio'));
});
