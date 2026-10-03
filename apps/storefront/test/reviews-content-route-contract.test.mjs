import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const reviewsPage = await readFile(
  new URL('../src/ReviewsPage.tsx', import.meta.url),
  'utf8',
);

test('Reviews route renders its published content without product CTA or messaging actions', () => {
  assert.match(reviewsPage, /loadSectionSnapshot/u);
  assert.match(reviewsPage, /loadProductSnapshot/u);
  assert.match(reviewsPage, /product\.body/u);
  assert.match(reviewsPage, /product\.media/u);
  assert.doesNotMatch(
    reviewsPage,
    /ProductDetailPage|loadPublicCta|StorefrontRouteAction|messages\/new/u,
  );
});
