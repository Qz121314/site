import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('hero active video controls media preload', async () => {
  const source = await readFile(new URL('../src/HomeFeed.tsx', import.meta.url), 'utf8');

  assert.match(source, /autoPlay=\{index === activeIndex\}/u);
  assert.match(source, /preload=\{index === activeIndex \? 'auto' : 'none'\}/u);
  assert.doesNotMatch(source, /preload=\{index === 0 \? 'auto' : 'metadata'\}/u);
});

test('home reserves high image priority for one meaningful LCP candidate', async () => {
  const [home, navigation] = await Promise.all([
    readFile(new URL('../src/HomeFeed.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/storefront-navigation.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(home, /fetchPriority=\{index === 0 \? 'high' : 'low'\}/u);
  assert.match(home, /loading=\{index === 0 \? 'eager' : 'lazy'\}/u);
  assert.match(home, /fetchPriority="low"[\s\S]{0,120}loading="lazy"/u);
  assert.match(home, /fetchPriority=\{priority \? 'high' : 'low'\}/u);
  assert.match(
    home,
    /priority=\{!hasHero && section\.id === priorityRecommendationSectionId\}/u,
  );
  assert.doesNotMatch(home, /SectionIcon priority=/u);
  assert.match(navigation, /fetchPriority="low"/u);
  assert.match(navigation, /decoding="async"/u);
});

test('product detail loads one primary carousel media eagerly and defers the rest', async () => {
  const source = await readFile(
    new URL('../src/ProductDetailPage.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /const mobileGalleryItems =/u);
  assert.match(source, /className="detail-mobile-media-track"/u);
  assert.match(source, /renderMobileMedia\(item, index === 0\)/u);
  assert.match(source, /loading=\{eager \? 'eager' : 'lazy'\}/u);
  assert.doesNotMatch(source, /product-detail-secondary-media/u);
  assert.doesNotMatch(source, /detail-mobile-thumbnails/u);
  assert.doesNotMatch(source, /preload="metadata"/u);
  assert.ok((source.match(/preload="none"/gu) ?? []).length >= 3);
});
