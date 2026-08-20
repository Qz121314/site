import { expect, test, type Page } from '@playwright/test';

const SECTION_SELECTOR = 'a[href^="/sections/"]:not([href*="/products/"])';
const PRODUCT_SELECTOR = 'a[href*="/products/"]';

async function documentFitsViewport(page: Page) {
  return page.evaluate(() => {
    const { clientWidth, scrollWidth } = document.documentElement;
    return scrollWidth <= clientWidth + 1;
  });
}

async function expectDocumentInsideViewport(page: Page) {
  await expect.poll(() => documentFitsViewport(page)).toBe(true);
}

test('primary mobile routes stay inside the document viewport', async ({ page }) => {
  for (const href of ['/', '/browse/', '/faq/', '/messages/']) {
    await page.goto(href);
    await expect(page.locator('#root')).not.toBeEmpty();
    await expectDocumentInsideViewport(page);
  }

  await page.goto('/browse/');
  const sectionHref = await page.locator(SECTION_SELECTOR).first().getAttribute('href');

  if (!sectionHref) return;
  await page.goto(sectionHref);
  await expectDocumentInsideViewport(page);

  const productHref = await page.locator(PRODUCT_SELECTOR).first().getAttribute('href');

  if (!productHref) return;
  await page.goto(productHref);
  await expectDocumentInsideViewport(page);
});
