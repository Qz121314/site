import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const productSource = await readFile(
  new URL('../src/ProductDetailPage.tsx', import.meta.url),
  'utf8',
);
const productCss = await readFile(
  new URL('../src/product-detail-ui.css', import.meta.url),
  'utf8',
);

test('mobile gallery contract', () => {
  assert.ok(productSource.includes('detail-mobile-media-track'));
  assert.ok(productSource.includes('mobileMediaIndex'));
  assert.ok(productCss.includes('scroll-snap-type: x mandatory;'));
  assert.ok(productCss.includes('scroll-snap-align: start;'));
  assert.ok(productCss.includes('-webkit-overflow-scrolling: touch;'));
});

test('detail navigation and body contract', () => {
  assert.ok(productSource.includes('className="product-detail-back"'));
  assert.ok(productSource.includes('<section className="product-detail-body">'));
  assert.ok(productCss.includes('border-radius: 50%;'));
  assert.ok(productCss.includes('border-top: 1px solid'));
});

test('CTA routing contract', () => {
  assert.ok(productSource.includes("cta.mode === 'customer_service'"));
  assert.ok(productSource.includes('<LinkComponent className="cta-button is-ready"'));
  assert.ok(productSource.includes('target="_blank"'));
});

test('flat detail geometry contract', () => {
  assert.ok(productCss.includes('var(--theme-radius-control, 4px)'));
  assert.ok(productCss.includes('var(--theme-radius-media, 0px)'));
  assert.ok(productCss.includes('box-shadow: none;'));
});
