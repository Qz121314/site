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
const shellCss = await readFile(new URL('../src/app-shell.css', import.meta.url), 'utf8');

test('product push page keeps the global brand bar', () => {
  assert.match(
    shellCss,
    /html\[data-storefront-presentation='push'\][\s\S]*?\.app-shell:has\(\.product-detail-page\)[\s\S]*?> \.topbar\s*\{[\s\S]*?display:\s*flex/u,
  );
});

test('mobile gallery keeps swipe and adds thumbnail navigation', () => {
  assert.ok(productSource.includes('detail-mobile-gallery'));
  assert.ok(productSource.includes('detail-mobile-media-track'));
  assert.ok(productSource.includes('detail-mobile-thumbnails'));
  assert.ok(productSource.includes('mobileMediaTrackRef'));
  assert.ok(productSource.includes('selectMobileMedia(index)'));
  assert.ok(productSource.includes('mobileMediaIndex + 1'));
  assert.ok(productCss.includes('scroll-snap-type: x mandatory;'));
  assert.ok(productCss.includes('scroll-snap-align: start;'));
  assert.ok(productCss.includes('scroll-snap-stop: always;'));
});

test('back control and body contract', () => {
  assert.ok(productSource.includes('className="product-detail-back"'));
  assert.ok(productSource.includes('<svg viewBox="0 0 20 20"'));
  assert.ok(productSource.includes('className="product-detail-back-label"'));
  assert.ok(productSource.includes('className="product-detail-body"'));
  assert.ok(productCss.includes('.product-detail-body {'));
  assert.ok(productCss.includes('border-top: 1px solid'));
  assert.match(
    productCss,
    /\.product-detail-back\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?min-width:\s*44px;[\s\S]*?height:\s*44px;[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;/u,
  );
  assert.match(
    productCss,
    /\.product-detail-back-label\s*\{[\s\S]*?white-space:\s*nowrap;/u,
  );
  assert.doesNotMatch(productCss, /\.product-detail-back\s*\{[^}]*border-radius:\s*50%/u);
});

test('CTA resolves only after user interaction', () => {
  assert.ok(productSource.includes('enabled: false'));
  assert.ok(productSource.includes('ctaQuery.refetch()'));
  assert.ok(productSource.includes('onClick={() => void handleCtaClick()}'));
  assert.ok(productSource.includes('window.location.assign(cta.path)'));
  assert.ok(productSource.includes('SYSTEM_UI.continue'));
  assert.ok(productSource.includes('is-unavailable'));
  assert.ok(!productSource.includes('enabled: Boolean(product?.id)'));
});

test('flat detail surface contract', () => {
  assert.ok(productCss.includes('var(--theme-radius-control, 4px)'));
  assert.ok(productCss.includes('var(--theme-radius-media, 0px)'));
  assert.ok(productCss.includes('box-shadow: none;'));
  assert.ok(productCss.includes('.product-detail-tags span + span::before'));
  assert.ok(productCss.includes("content: '·';"));
});
