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
const sectionSource = await readFile(new URL('../src/SectionPage.tsx', import.meta.url), 'utf8');
const copySource = await readFile(new URL('../src/storefront-copy.tsx', import.meta.url), 'utf8');

test('mobile storefront mounts one global edge navigation controller', () => {
  assert.match(mainSource, /import \{ MobileEdgeNavigation \}/u);
  assert.match(mainSource, /<MobileEdgeNavigation \/>/u);
  assert.match(edgeSource, /max-width:\s*767px/u);
  assert.match(edgeSource, /touchstart/u);
  assert.match(edgeSource, /touchmove/u);
  assert.match(edgeSource, /TRIGGER_DISTANCE\s*=\s*76/u);
});

test('edge gestures support both internal Back and Forward without hijacking horizontal media', () => {
  assert.match(edgeSource, /canNavigateStorefrontBack/u);
  assert.match(edgeSource, /canNavigateStorefrontForward/u);
  assert.match(edgeSource, /navigateStorefrontBack/u);
  assert.match(edgeSource, /navigateStorefrontForward/u);
  for (const selector of [
    'hero-carousel-viewport',
    'home-product-rail',
    'section-tag-filter',
    'detail-gallery',
  ]) {
    assert.equal(edgeSource.includes(selector), true, `${selector} must remain gesture-safe`);
  }
  assert.match(edgeSource, /event\.preventDefault\(\)/u);
});

test('SPA history entries are position-aware so a completed Back can be followed by Forward', () => {
  assert.match(historySource, /__storefrontNavigationIndex/u);
  assert.match(historySource, /recordStorefrontHistoryPush/u);
  assert.match(historySource, /window\.history\.replaceState/u);
  assert.match(historySource, /window\.history\.back\(\)/u);
  assert.match(historySource, /window\.history\.forward\(\)/u);
  assert.match(historySource, /storefrontNavDirection/u);
});

test('mobile page transitions follow navigation direction and expose an edge affordance', () => {
  assert.match(shellCss, /\.mobile-edge-navigation/u);
  assert.match(shellCss, /data-storefront-nav-direction='forward'/u);
  assert.match(shellCss, /data-storefront-nav-direction='back'/u);
  assert.match(shellCss, /@keyframes app-page-enter-forward/u);
  assert.match(shellCss, /@keyframes app-page-enter-back/u);
});

test('section return control is a backend-driven Back action instead of a Browse label', () => {
  assert.match(sectionSource, /sectionCopy\.backLabel/u);
  assert.match(sectionSource, /handleBack/u);
  assert.match(sectionSource, /navigateStorefrontBack/u);
  assert.match(copySource, /section:\s*\{[\s\S]*backLabel:\s*'Back'/u);
  assert.doesNotMatch(sectionSource, />\s*Browse\s*</u);
});
