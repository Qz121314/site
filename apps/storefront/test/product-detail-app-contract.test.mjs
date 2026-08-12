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

test('mobile product media is a swipe-first scroll-snap gallery', () => {
  assert.match(productSource, /detail-mobile-media-track/u);
  assert.match(productSource, /mobileMediaIndex/u);
  assert.match(productCss, /scroll-snap-type:\s*x mandatory/u);
  assert.match(productCss, /scroll-snap-align:\s*start/u);
  assert.match(productCss, /-webkit-overflow-scrolling:\s*touch/u);
});

test('product detail uses an icon back control and continuous article body', () => {
  assert.match(
    productSource,
    /className="product-detail-back"[\s\S]*?<svg[\s\S]*?<span className="sr-only">\{SYSTEM_UI\.back\}/u,
  );
  assert.match(productCss, /\.product-detail-back[\s\S]*?border-radius:\s*50%/u);
  assert.match(
    productSource,
    /<\/div>\s*\{product\.body\.trim\(\) \? \(\s*<section className="product-detail-body">/u,
  );
  assert.match(
    productCss,
    /\.product-detail-body\s*\{[\s\S]*?border-top:\s*1px solid/u,
  );
});

test('customer-service CTA stays inside the mounted storefront shell', () => {
  assert.match(
    productSource,
    /cta\.mode === 'customer_service'[\s\S]*?<LinkComponent className="cta-button is-ready" href=\{cta\.path\}>/u,
  );
  assert.match(
    productSource,
    /<a[\s\S]*?className="cta-button is-ready"[\s\S]*?target="_blank"/u,
  );
});

test('product detail keeps flat content surfaces and restrained CTA geometry', () => {
  assert.match(
    productCss,
    /\.product-detail-fixed-action \.cta-button\s*\{[\s\S]*?border-radius:\s*var\(--theme-detail-cta-radius, var\(--theme-radius-control, 4px\)\)/u,
  );
  assert.match(
    productCss,
    /\.product-detail-body \.markdown-content :is\(img, video\)[\s\S]*?border-radius:\s*var\(--theme-radius-media, 0px\)/u,
  );
});
