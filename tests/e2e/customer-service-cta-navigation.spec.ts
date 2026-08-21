import { expect, test } from '@playwright/test';
import { findPublishedProductRoute } from './published-storefront-fixtures';

test('customer-service CTA reaches the Worker /go route as a document request', async ({
  page,
  request,
}) => {
  const publishedRoute = await findPublishedProductRoute(request);
  test.skip(!publishedRoute, 'No published product is available for CTA verification.');

  await page.goto(publishedRoute!.productHref);
  const cta = page.locator(
    '.storefront-route-action-host .product-detail-route-action .cta-button',
  );
  await expect(cta).toBeVisible();

  await page.route('**/api/public/storefront/cta/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        available: true,
        label: 'Contact',
        mode: 'customer_service',
        path: '/go/__cta-navigation-test__',
      }),
    });
  });

  let conversionRequestType: string | null = null;
  await page.route('**/go/__cta-navigation-test__', async (route) => {
    conversionRequestType = route.request().resourceType();
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>conversion reached</title>',
    });
  });

  await cta.click();
  await expect.poll(() => conversionRequestType).toBe('document');
  await expect(page).toHaveURL(/\/go\/__cta-navigation-test__$/u);
});
