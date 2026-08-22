import { expect, test } from '@playwright/test';
import { installLocalCustomerServiceCtaFixture } from './customer-service-cta-local-fixture';
import { findPublishedProductRoute } from './published-storefront-fixtures';

const useLocalFixture = process.env.E2E_LOCAL_SERVER === '1';

test('customer-service CTA opens the chat shell before the Worker handoff resolves', async ({
  page,
  request,
}) => {
  const productHref = useLocalFixture
    ? await installLocalCustomerServiceCtaFixture(page)
    : (await findPublishedProductRoute(request))?.productHref;
  test.skip(!productHref, 'No published product is available for CTA verification.');

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
  let conversionRequestCount = 0;
  await page.route('**/go/__cta-navigation-test__', async (route) => {
    conversionRequestCount += 1;
    conversionRequestType = route.request().resourceType();
    conversionAcceptHeader = route.request().headers().accept ?? null;
    await holdHandoff;
    await route.abort();
  });

  await page.goto(productHref!);
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
  expect(conversionRequestCount).toBe(1);

  releaseHandoff();
});
