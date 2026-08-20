import { expect, test, type Page } from '@playwright/test';

async function expectDocumentInsideViewport(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
    )
    .toEqual(
      expect.objectContaining({
        clientWidth: expect.any(Number),
        scrollWidth: expect.any(Number),
      }),
    );

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

test('primary mobile storefront routes do not widen the document viewport', async ({ page }) => {
  for (const href of ['/', '/browse/', '/faq/', '/messages/']) {
    await page.goto(href);
    await expect(page.locator('#root')).not.toBeEmpty();
    await expectDocumentInsideViewport(page);
  }

  await page.goto('/browse/');
  const sectionHref = await page
    .locator('a[href^="/sections/"]:not([href*="/products/"])')
    .first()
    .getAttribute('href');

  if (!sectionHref) return;
  await page.goto(sectionHref);
  await expectDocumentInsideViewport(page);

  const productHref = await page.locator('a[href*="/products/"]').first().getAttribute('href');
  if (!productHref) return;
  await page.goto(productHref);
  await expectDocumentInsideViewport(page);
});
