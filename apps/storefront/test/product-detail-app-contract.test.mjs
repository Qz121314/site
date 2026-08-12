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
  assert.equal(productSource.includes('detail-mobile-media-track'), true);
  assert.equal(productSource.includes('mobileMediaIndex'), true);
  assert.equal(productCss.includes('scroll-snap-type: x mandatory;'), true);
  assert.equal(productCss.includes('scroll-snap-align: start;'), true);
  assert.equal(
    productCss.includes('-webkit-overflow-scrolling: touch;'),
    true,
  );
});

test('product detail uses an icon back control and continuous article body', () => {
  const backControl = productSource.indexOf('className="product-detail-back"');
  const backIcon = productSource.indexOf('<svg viewBox="0 0 20 20"', backControl);
  const bodySection = productSource.indexOf(
    '<section className="product-detail-body">',
  );
  const heroEnd = productSource.indexOf('</div>\n\n        {product.body.trim()');

  assert.ok(backControl >= 0);
  assert.ok(backIcon > backControl);
  assert.ok(heroEnd >= 0);
  assert.ok(bodySection > heroEnd);
  assert.equal(productCss.includes('border-radius: 50%;'), true);
  assert.equal(productCss.includes('border-top: 1px solid'), true);
});

test('customer-service CTA stays inside the mounted storefront shell', () => {
  const serviceBranch = productSource.indexOf("cta.mode === 'customer_service'");
  const internalCta = productSource.indexOf(
    '<LinkComponent className="cta-button is-ready"',
    serviceBranch,
  );
  const externalCta = productSource.indexOf(
    'className="cta-button is-ready"',
    internalCta + 1,
  );
  const externalTarget = productSource.indexOf('target="_blank"', externalCta);

  assert.ok(serviceBranch >= 0);
  assert.ok(internalCta > serviceBranch);
  assert.ok(externalCta > internalCta);
  assert.ok(externalTarget > externalCta);
});

test('product detail keeps flat content surfaces and restrained CTA geometry', () => {
  assert.equal(productCss.includes('var(--theme-radius-control, 4px)'), true);
  assert.equal(productCss.includes('var(--theme-radius-media, 0px)'), true);
  assert.equal(productCss.includes('box-shadow: none;'), true);
});
