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

test('Storefront loads backend copy without making copy availability a page-fatal dependency', () => {
  assert.match(copySource, /fetch\('\/api\/public\/storefront-copy\//u);
  assert.match(rootSource, /queryKey:\s*\['storefront-copy'\]/u);
  assert.match(rootSource, /copyQuery\.data \?\? FALLBACK_STOREFRONT_COPY/u);
  assert.match(rootSource, /<StorefrontCopyProvider/u);
});

test('primary navigation labels come from Bottom Navigation config with Storefront Copy fallback', () => {
  assert.match(navigationSource, /navigation:\s*StorefrontCopy\['navigation'\]/u);
  assert.match(navigationSource, /navigation\.items/u);
  assert.match(navigationSource, /label:\s*item\.label/u);
  assert.match(copySource, /loadBottomNavigation\(signal\)\.catch\(\(\) => null\)/u);
  assert.match(
    copySource,
    /label:\s*normalizedWithoutNavigation\.navigation\[item\.key\]/u,
  );
});

test('normal storefront business copy is not re-hardcoded in the root or support UI', () => {
  const normalUiSource = `${rootSource}\n${supportSource}`;
  for (const text of [
    'Hot picks',
    'Latest services',
    'Search sections, products, or tags',
    'About this service',
    'Ready to connect?',
    'No conversations yet',
    'Customer Support',
    'Waiting for an agent…',
  ]) {
    assert.equal(
      normalUiSource.includes(text),
      false,
      `${text} must come from Storefront Copy`,
    );
  }
});

test('system error and accessibility copy remains separate from business copy', () => {
  assert.match(rootSource, /Storefront unavailable/u);
  assert.match(supportSource, /aria-label="Add attachment"/u);
  assert.match(supportSource, /aria-label="Send message"/u);
});
