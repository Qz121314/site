import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bottomNavigationActiveHref,
  parseStorefrontRoute,
  productHref,
  sectionHref,
} from '../src/routing.ts';

test('canonical storefront links use section and product slugs', () => {
  assert.equal(sectionHref({ id: 'section-1', slug: 'home-services' }), '/sections/home-services/');
  assert.equal(
    productHref({
      id: 'product-1',
      slug: 'deep-clean',
      sectionId: 'section-1',
      sectionSlug: 'home-services',
    }),
    '/sections/home-services/products/deep-clean/',
  );
});

test('routing accepts primary pages, canonical slug paths and legacy product paths', () => {
  assert.deepEqual(parseStorefrontRoute('/discover/'), { type: 'discover' });
  assert.deepEqual(parseStorefrontRoute('/messages/'), { type: 'messages' });
  assert.deepEqual(parseStorefrontRoute('/messages/conversation-1/'), {
    type: 'message',
    conversationRef: 'conversation-1',
  });
  assert.deepEqual(parseStorefrontRoute('/faq/'), { type: 'faq' });
  assert.deepEqual(parseStorefrontRoute('/sections/home-services/'), {
    type: 'section',
    sectionRef: 'home-services',
  });
  assert.deepEqual(parseStorefrontRoute('/sections/home-services/products/deep-clean/'), {
    type: 'product',
    sectionRef: 'home-services',
    productRef: 'deep-clean',
  });
  assert.deepEqual(parseStorefrontRoute('/products/product-1/'), {
    type: 'product',
    sectionRef: null,
    productRef: 'product-1',
  });
});

test('bottom navigation keeps browsing routes under discover and chat routes under messages', () => {
  assert.equal(bottomNavigationActiveHref('/'), '/');
  assert.equal(bottomNavigationActiveHref('/discover/'), '/discover/');
  assert.equal(bottomNavigationActiveHref('/sections/home-services/'), '/discover/');
  assert.equal(bottomNavigationActiveHref('/sections/home-services/products/deep-clean/'), '/discover/');
  assert.equal(bottomNavigationActiveHref('/products/product-1/'), '/discover/');
  assert.equal(bottomNavigationActiveHref('/messages/'), '/messages/');
  assert.equal(bottomNavigationActiveHref('/messages/conversation-1/'), '/messages/');
  assert.equal(bottomNavigationActiveHref('/faq/'), '/faq/');
});

test('routing rejects malformed or oversized route parts', () => {
  assert.deepEqual(parseStorefrontRoute('/sections/%E0%A4%A/'), { type: 'not-found' });
  assert.deepEqual(parseStorefrontRoute(`/products/${'a'.repeat(121)}/`), { type: 'not-found' });
  assert.deepEqual(parseStorefrontRoute(`/messages/${'a'.repeat(121)}/`), { type: 'not-found' });
  assert.deepEqual(parseStorefrontRoute('/unknown/path/'), { type: 'not-found' });
});
