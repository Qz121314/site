import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const reviewsPage = await readFile(
  new URL('../src/ReviewsPage.tsx', import.meta.url),
  'utf8',
);

const contentRoute = await readFile(
  new URL('../src/content-route.ts', import.meta.url),
  'utf8',
);

test('Reviews route renders its published content without product CTA or messaging actions', () => {
  assert.match(reviewsPage, /loadReviewsPageSnapshot/u);
  assert.match(reviewsPage, /query\.data\.body/u);
  assert.match(contentRoute, /bootstrap\.pointer\.reviews/u);
  assert.match(contentRoute, /v2ModulePath\('reviews', reference, 'page\.json'\)/u);
  assert.doesNotMatch(
    reviewsPage,
    /loadSectionSnapshot|loadProductSnapshot|product\.media|ProductDetailPage|loadPublicCta|StorefrontRouteAction|messages\/new/u,
  );
});
