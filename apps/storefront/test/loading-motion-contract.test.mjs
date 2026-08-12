import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootSource = await readFile(
  new URL('../src/StorefrontRoot.tsx', import.meta.url),
  'utf8',
);
const browseSource = await readFile(new URL('../src/BrowsePage.tsx', import.meta.url), 'utf8');
const sectionSource = await readFile(
  new URL('../src/SectionPage.tsx', import.meta.url),
  'utf8',
);
const loadingSource = await readFile(
  new URL('../src/LoadingStates.tsx', import.meta.url),
  'utf8',
);
const loadingCss = await readFile(
  new URL('../src/loading-states.css', import.meta.url),
  'utf8',
);
const baseCss = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

test('startup and lazy-route loading use restrained visual primitives', () => {
  assert.ok(rootSource.includes('if (bootstrapQuery.isLoading) return <StartupLoader />;'));
  assert.ok(rootSource.includes('<Suspense fallback={<RouteProgress />}>'));
  assert.ok(loadingSource.includes('className="loading-halo"'));
  assert.ok(loadingSource.includes('className="route-progress"'));
  assert.doesNotMatch(rootSource, /loading-shell|loading-brand|loading-card/u);
});

test('content requests use square skeletons instead of visible Loading text', () => {
  assert.ok(browseSource.includes('<SquareSkeletonGrid count={4} />'));
  assert.ok(sectionSource.includes('<SquareSkeletonGrid count={6} />'));
  assert.doesNotMatch(browseSource, /inline-loading[^\n]*SYSTEM_UI\.loading/u);
  assert.doesNotMatch(sectionSource, /inline-loading[^\n]*SYSTEM_UI\.loading/u);
});

test('loading motion stays thin, theme-aware and reduced-motion safe', () => {
  assert.match(loadingCss, /\.route-progress[\s\S]*?height:\s*2px;/u);
  assert.match(loadingCss, /\.loading-square[\s\S]*?aspect-ratio:\s*1 \/ 1;/u);
  assert.ok(loadingCss.includes('color-mix(in srgb, var(--brand)'));
  assert.ok(loadingCss.includes('@media (prefers-reduced-motion: reduce)'));
  assert.ok(loadingCss.includes('.app-shell .home-product-skeleton::after'));
  assert.ok(loadingCss.includes('loading-cta-breathe'));
});

test('legacy blocky shimmer placeholders are removed from base styles', () => {
  assert.doesNotMatch(baseCss, /\.loading-brand|\.loading-card|\.loading-grid/u);
  assert.match(baseCss, /\.inline-loading::after/u);
});
