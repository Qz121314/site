import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootSource = await readFile(
  new URL('../src/StorefrontRoot.tsx', import.meta.url),
  'utf8',
);
const supportSource = await readFile(
  new URL('../src/support-ui.tsx', import.meta.url),
  'utf8',
);
const navigationSource = await readFile(
  new URL('../src/storefront-navigation.tsx', import.meta.url),
  'utf8',
);
const copySource = await readFile(
  new URL('../src/storefront-copy.tsx', import.meta.url),
  'utf8',
);

test('Storefront UI copy is frontend-owned and no longer fetched from site settings', () => {
  assert.match(copySource, /export const STOREFRONT_COPY/u);
  assert.doesNotMatch(copySource, /\/api\/public\/storefront-copy/u);
  assert.doesNotMatch(copySource, /createContext|StorefrontCopyProvider/u);
  assert.doesNotMatch(rootSource, /queryKey:\s*\['storefront-copy'\]/u);
  assert.doesNotMatch(rootSource, /StorefrontCopyProvider/u);
});

test('bottom navigation remains backend-configurable independently of UI copy', () => {
  assert.match(rootSource, /queryKey:\s*\['bottom-navigation'\]/u);
  assert.match(rootSource, /loadBottomNavigation\(signal\)/u);
  assert.match(rootSource, /navigationQuery\.data \?\? FALLBACK_BOTTOM_NAVIGATION/u);
  assert.match(navigationSource, /navigationItems:\s*BottomNavigationItemConfig\[\]/u);
  assert.match(navigationSource, /label:\s*item\.label/u);
});

test('normal storefront UI copy stays centralized instead of being duplicated in page components', () => {
  const pageSource = `${rootSource}\n${supportSource}`;
  for (const text of [
    'Hot picks',
    'Latest services',
    'About this service',
    'Ready to connect?',
    'No conversations yet',
    'Customer Support',
    'Waiting for an agent…',
    'Add attachment',
    'Send message',
  ]) {
    assert.equal(
      pageSource.includes(text),
      false,
      `${text} must stay in the frontend copy module`,
    );
  }
});

test('search prompts describe the user action instead of internal content structure', () => {
  assert.doesNotMatch(copySource, /Search sections, products, or tags|Name, type or tag/u);
  assert.equal(copySource.match(/searchPlaceholder:\s*'Search'/gu)?.length, 2);
});

test('system failure copy remains separate while accessibility labels use the frontend copy module', () => {
  assert.match(rootSource, /Storefront unavailable/u);
  assert.match(supportSource, /aria-label=\{messages\.attachmentLabel\}/u);
  assert.match(supportSource, /aria-label=\{messages\.sendLabel\}/u);
});
