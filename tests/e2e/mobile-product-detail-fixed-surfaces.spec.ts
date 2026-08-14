import { expect, test, type Page } from '@playwright/test';

const SECTION_LINK = 'a[href^="/sections/"]:not([href*="/products/"])';
const PRODUCT_LINK = 'a.section-product-card[href*="/products/"]';

async function findProductHref(page: Page): Promise<string | null> {
  await page.goto('/browse/');
  const sectionHrefs = await page.locator(SECTION_LINK).evaluateAll((links) => {
    const hrefs = links.map((link) => link.getAttribute('href'));
    return [...new Set(hrefs.filter(Boolean))];
  });

  for (const sectionHref of sectionHrefs) {
    if (!sectionHref) continue;
    await page.goto(sectionHref);
    const card = page.locator(PRODUCT_LINK).first();
    if ((await card.count()) > 0) return card.getAttribute('href');
  }

  return null;
}

test('mobile product fixed surfaces respect safe areas', async ({ page }) => {
  test.setTimeout(60_000);

  const productHref = await findProductHref(page);
  test.skip(!productHref, 'No published product.');

  await page.goto(productHref!);
  await expect(page.locator('.product-detail-page')).toBeVisible();
  await expect(page.locator('.product-detail-fixed-action')).toBeVisible();
  await expect(page.locator('.app-shell > .bottom-nav')).toBeHidden();

  const geometry = await page.evaluate(() => {
    const topbar = document.querySelector<HTMLElement>('.app-shell > .topbar');
    const nav = document.querySelector<HTMLElement>('.product-detail-navigation');
    const product = document.querySelector<HTMLElement>('.product-detail-page');
    const action = document.querySelector<HTMLElement>(
      '.product-detail-fixed-action',
    );
    const cta = action?.querySelector<HTMLElement>('.cta-button');

    const barRect = topbar?.getBoundingClientRect();
    const actionRect = action?.getBoundingClientRect();
    const ctaRect = cta?.getBoundingClientRect();

    return {
      viewH: window.innerHeight,
      barBottom: barRect?.bottom ?? 0,
      navTop: nav ? Number.parseFloat(getComputedStyle(nav).top) : 0,
      actionTop: actionRect?.top ?? 0,
      actionBottom: actionRect?.bottom ?? 0,
      actionH: actionRect?.height ?? 0,
      ctaH: ctaRect?.height ?? 0,
      paddingB: product
        ? Number.parseFloat(getComputedStyle(product).paddingBottom)
        : 0,
    };
  });

  expect(geometry.navTop).toBeGreaterThanOrEqual(geometry.barBottom - 1);
  expect(geometry.actionTop).toBeGreaterThan(0);
  expect(geometry.actionBottom).toBeLessThanOrEqual(geometry.viewH + 1);
  expect(geometry.ctaH).toBeGreaterThanOrEqual(50);
  expect(geometry.paddingB).toBeGreaterThanOrEqual(geometry.actionH + 8);

  console.log('PRODUCT_DETAIL_FIXED_SURFACES_ACCEPTANCE=passed');
});
