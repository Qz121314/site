import { expect, test, type Page } from '@playwright/test';

async function expectDocumentInsideViewport(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth <= root.clientWidth + 1;
      }),
    )
    .toBe(true);
}

test('primary mobile routes stay inside the document viewport', async ({ page }) => {
  for (const href of ['/', '/browse/', '/faq/', '/messages/']) {
    await page.goto(href);
    await expect(page.locator('#root')).not.toBeEmpty();
    await expectDocumentInsideViewport(page);
  }

  await page.goto('/browse/');
  const sectionLink = page.locator(
    'a[href^="/sections/"]:not([href*="/products/"])',
  );
  const sectionHref = await sectionLink.first().getAttribute('href');

  if (!sectionHref) return;
  await page.goto(sectionHref);
  await expectDocumentInsideViewport(page);

  const productLink = page.locator('a[href*="/products/"]');
  const productHref = await productLink.first().getAttribute('href');
  if (!productHref) return;

  await page.goto(productHref);
  await expectDocumentInsideViewport(page);
});
