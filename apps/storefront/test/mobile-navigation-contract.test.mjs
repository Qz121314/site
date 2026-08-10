import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mainSource = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const edgeSource = await readFile(
  new URL('../src/MobileEdgeNavigation.tsx', import.meta.url),
  'utf8',
);
const historySource = await readFile(
  new URL('../src/storefront-history.ts', import.meta.url),
  'utf8',
);
const shellCss = await readFile(new URL('../src/app-shell.css', import.meta.url), 'utf8');
const sectionSource = await readFile(
  new URL('../src/SectionPage.tsx', import.meta.url),
  'utf8',
);
const copySource = await readFile(
  new URL('../src/storefront-copy.tsx', import.meta.url),
  'utf8',
);

test('mobile storefront mounts one global edge navigation controller', () => {
  assert.equal(
    mainSource.includes("import { MobileEdgeNavigation } from './MobileEdgeNavigation';"),
    true,
  );
  assert.equal(mainSource.includes('<MobileEdgeNavigation />'), true);
  assert.equal(edgeSource.includes("window.matchMedia('(max-width: 767px)')"), true);
  assert.equal(
    edgeSource.includes("window.matchMedia('(display-mode: standalone)')"),
    true,
  );
  assert.equal(edgeSource.includes('StandaloneNavigator'), true);
  assert.equal(edgeSource.includes('touchstart'), true);
  assert.equal(edgeSource.includes('touchmove'), true);
  assert.equal(edgeSource.includes('const TRIGGER_DISTANCE = 76;'), true);
});

test('edge gestures support both internal Back and Forward without hijacking horizontal media', () => {
  for (const symbol of [
    'canNavigateStorefrontBack',
    'canNavigateStorefrontForward',
    'navigateStorefrontBack',
    'navigateStorefrontForward',
  ]) {
    assert.equal(edgeSource.includes(symbol), true, `${symbol} must remain wired`);
  }
  for (const selector of [
    'hero-carousel-viewport',
    'home-product-rail',
    'section-tag-filter',
    'detail-gallery',
  ]) {
    assert.equal(
      edgeSource.includes(selector),
      true,
      `${selector} must remain gesture-safe`,
    );
  }
  assert.equal(edgeSource.includes('event.preventDefault()'), true);
});

test('SPA history entries restore scroll and preserve Back then Forward navigation', () => {
  for (const marker of [
    '__storefrontNavigationIndex',
    '__storefrontScrollY',
    "window.history.scrollRestoration = 'manual'",
    'saveCurrentStorefrontScrollPosition',
    'recordStorefrontHistoryPush',
    'window.history.replaceState',
    'window.history.back()',
    'window.history.forward()',
    'window.scrollTo',
    'storefrontNavDirection',
  ]) {
    assert.equal(
      historySource.includes(marker),
      true,
      `${marker} must remain in the navigation history layer`,
    );
  }
  assert.equal(edgeSource.includes('handleClickCapture'), true);
});

test('only pushed detail routes animate while primary tabs remain stationary', () => {
  for (const marker of [
    '.mobile-edge-navigation',
    "data-storefront-nav-direction='forward'",
    "data-storefront-nav-direction='back'",
    "data-storefront-transition='push'",
    "data-storefront-transition='pop'",
    '@keyframes app-page-enter-forward',
    '@keyframes app-page-enter-back',
  ]) {
    assert.equal(
      shellCss.includes(marker),
      true,
      `${marker} must remain in the app shell`,
    );
  }
  assert.equal(shellCss.includes('@keyframes app-page-enter {'), false);
  assert.equal(shellCss.includes('@keyframes app-tab-settle'), false);
});

test('section return control is a backend-driven Back action instead of a Browse label', () => {
  assert.equal(sectionSource.includes('sectionCopy.backLabel'), true);
  assert.equal(sectionSource.includes('handleBack'), true);
  assert.equal(sectionSource.includes('navigateStorefrontBack'), true);
  assert.equal(copySource.includes("backLabel: 'Back'"), true);
  assert.equal(sectionSource.includes('>Browse<'), false);
});
