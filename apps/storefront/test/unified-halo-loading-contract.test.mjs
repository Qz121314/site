import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('CTA and Admin share one Halo Loading primitive without route overlap', async () => {
  const [productDetail, adminApp, loadingCss] = await Promise.all([
    readFile(new URL('../src/ProductDetailPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../admin/src/App.tsx', import.meta.url), 'utf8'),
    readFile(
      new URL('../../../packages/storefront-ui/src/loading.css', import.meta.url),
      'utf8',
    ),
  ]);

  assert.match(productDetail, /LoadingHaloOverlay/u);
  assert.match(productDetail, /ctaNavigating \? <LoadingHaloOverlay/u);
  assert.match(productDetail, /<LoadingHalo size="small" \/>/u);
  assert.doesNotMatch(productDetail, /product-detail-cta-spinner/u);

  assert.match(adminApp, /LoadingHalo/u);
  assert.doesNotMatch(adminApp, /loading-indicator/u);

  assert.match(loadingCss, /\.loading-halo-overlay \{[\s\S]*position: fixed;/u);
  assert.match(loadingCss, /pointer-events: auto;/u);
  assert.match(loadingCss, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.doesNotMatch(loadingCss, /view-transition/u);
});
