import { expect, test } from '@playwright/test';
import { findPublishedProductRoute } from './published-storefront-fixtures';

test('customer-service CTA opens the chat shell before the Worker handoff resolves', async ({
  page,
  request,
}) => {
  const publishedRoute = await findPublishedProductRoute(request);
  test.skip(!publishedRoute, 'No published product is available for CTA verification.');

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

  let releaseHandoff!: () => void;
  const holdHandoff = new Promise<void>((resolve) => {
    releaseHandoff = resolve;
  });
  let conversionRequestType: string | null = null;
  let conversionAcceptHeader: string | null = null;
  await page.route('**/go/__cta-navigation-test__', async (route) => {
    conversionRequestType = route.request().resourceType();
    conversionAcceptHeader = route.request().headers().accept ?? null;
    await holdHandoff;
    await route.abort();
  });

  await page.goto(publishedRoute!.productHref);
  const cta = page.locator(
    '.storefront-route-action-host .product-detail-route-action .cta-button',
  );
  await expect(cta).toBeVisible();
  await expect(cta).toContainText('Contact');

  await cta.click();

  await expect(page).toHaveURL(/\/messages\/new\/\?/u);
  await expect(page.locator('.chat-page')).toBeVisible();
  await expect(page.locator('.chat-header')).toBeVisible();
  await expect(page.locator('.chat-product-card')).toBeVisible();
  await expect(page.locator('.chat-composer')).toBeVisible();
  await expect(page.locator('.chat-connection-state .loading-halo')).toBeVisible();
  await expect.poll(() => conversionRequestType).toBe('fetch');
  expect(conversionAcceptHeader).toContain('application/json');

  releaseHandoff();
});
