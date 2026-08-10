import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootSource = await readFile(
  new URL('../src/StorefrontRoot.tsx', import.meta.url),
  'utf8',
);
const homeSource = await readFile(new URL('../src/HomeFeed.tsx', import.meta.url), 'utf8');
const browseSource = await readFile(new URL('../src/BrowsePage.tsx', import.meta.url), 'utf8');
const sectionSource = await readFile(new URL('../src/SectionPage.tsx', import.meta.url), 'utf8');
const productSource = await readFile(new URL('../src/ProductDetailPage.tsx', import.meta.url), 'utf8');
const faqSource = await readFile(new URL('../src/FaqPage.tsx', import.meta.url), 'utf8');
const supportSource = await readFile(new URL('../src/support-ui.tsx', import.meta.url), 'utf8');
const navigationSource = await readFile(
  new URL('../src/storefront-navigation.tsx', import.meta.url),
  'utf8',
);
const systemUiSource = await readFile(new URL('../src/system-ui.ts', import.meta.url), 'utf8');

const storefrontPages = [
  rootSource,
  homeSource,
  browseSource,
  sectionSource,
  productSource,
  faqSource,
  supportSource,
].join('\n');

test('business content is backend-driven instead of coming from a storefront copy module', () => {
  assert.doesNotMatch(storefrontPages, /useStorefrontCopy|STOREFRONT_COPY/u);
  assert.doesNotMatch(rootSource, /storefront-copy/u);
  assert.match(homeSource, /slide\.title/u);
  assert.match(homeSource, /section\.name/u);
  assert.match(productSource, /product\.title/u);
  assert.match(productSource, /product\.cta\.label/u);
  assert.match(faqSource, /article\.title/u);
  assert.match(supportSource, /conversation\.agentName/u);
});

test('invented marketing and customer-service prose is absent from storefront page code', () => {
  for (const text of [
    'Explore',
    'Services',
    'Hot picks',
    'Latest services',
    'Browse services',
    'About this service',
    'Ready to connect?',
    'Customer Support',
    'No conversations yet',
    'Waiting for an agent',
    'Conversation ended',
    'Select a conversation',
    'The storefront is temporarily unavailable',
  ]) {
    assert.equal(storefrontPages.includes(text), false, `${text} must not be hardcoded in storefront pages`);
  }
});

test('only compact interaction and system-state labels are centralized in system-ui', () => {
  for (const key of ['back', 'search', 'retry', 'loading', 'send', 'install']) {
    assert.match(systemUiSource, new RegExp(`\\b${key}:`, 'u'));
  }
  assert.doesNotMatch(systemUiSource, /service|product|customer support|hot|latest|explore/iu);
});

test('bottom navigation labels come from backend configuration with no local label fallback', () => {
  assert.match(rootSource, /loadBottomNavigation\(signal\)/u);
  assert.match(rootSource, /navigationQuery\.data \?\? \[\]/u);
  assert.doesNotMatch(rootSource, /FALLBACK_BOTTOM_NAVIGATION/u);
  assert.match(navigationSource, /label:\s*item\.label/u);
});
