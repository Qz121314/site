import { expect, test } from '@playwright/test';

test('customer-service CTA reaches the Worker /go route as a document request', async ({
  page,
}) => {
  await page.goto('/browse/');
  const sectionHref = await page
    .locator('a[href^="/sections/"]:not([href*="/products/"])')
    .first()
    .getAttribute('href');
  test.skip(!sectionHref, 'No published section is available for CTA verification.');

  await page.goto(sectionHref!);
  const productHref = await page
    .locator('a[href*="/products/"]')
    .first()
    .getAttribute('href');
  test.skip(!productHref, 'No published product is available for CTA verification.');

  await page.goto(productHref!);
  const cta = page.locator('.product-detail-fixed-action .cta-button');
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
