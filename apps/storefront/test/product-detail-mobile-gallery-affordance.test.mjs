import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/ProductDetailPage.tsx', import.meta.url), 'utf8');
const css = readFileSync(
  new URL('../src/product-detail-content-flow.css', import.meta.url),
  'utf8',
);

test('mobile product gallery is compact and clearly communicates swipe navigation', () => {
  assert.match(source, /function scrollMobileGalleryToIndex\(index: number\)/u);
  assert.match(source, /className="detail-mobile-media-navigation"/u);
  assert.match(source, /className="detail-mobile-media-nav is-previous"/u);
  assert.match(source, /className="detail-mobile-media-nav is-next"/u);
  assert.match(source, /className="detail-mobile-media-pagination"/u);
  assert.match(source, /className=\{`detail-mobile-media-dot/u);

  assert.match(
    css,
    /\.detail-mobile-gallery \{[\s\S]*width: 100%;[\s\S]*margin-inline: 0;[\s\S]*border-radius:/u,
  );
  assert.match(
    css,
    /\.detail-mobile-media-count \{[\s\S]*top: 12px;[\s\S]*min-width: 50px;[\s\S]*font-weight: 760;/u,
  );
  assert.match(
    css,
    /\.detail-mobile-media-pagination \{[\s\S]*bottom: 10px;[\s\S]*backdrop-filter:/u,
  );
  assert.match(
    css,
    /\.detail-mobile-media-nav \{[\s\S]*width: 34px;[\s\S]*height: 34px;/u,
  );
});
