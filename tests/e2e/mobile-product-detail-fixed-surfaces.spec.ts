import { expect, test, type Page } from '@playwright/test';

async function findPublishedProductHref(page: Page): Promise<string | null> {
  await page.goto('/browse/');
  const sectionHrefs = await page
    .locator('a[href^="/sections/"]:not([href*="/products/"])')
    .evaluateAll((links) => {
      const hrefs = links.map((link) => link.getAttribute('href')).filter(Boolean);
      return [...new Set(hrefs)];
    });

  for (const sectionHref of sectionHrefs) {
    if (!sectionHref) continue;
    await page.goto(sectionHref);
    const productHref = await page
      .locator('a.section-product-card[href*="/products/"]')
      .first()
      .getAttribute('href')
      .catch(() => null);
    if (productHref) return productHref;
  }

  return null;
}

test('mobile product detail fixed surfaces stay clear of navigation and viewport edges', async ({
  page,
}) => {
  test.setTimeout(60_000);

  const productHref = await findPublishedProductHref(page);
  test.skip(
    !productHref,
    'No published product is available for production acceptance.',
  );

  await page.goto(productHref!);
  await expect(page.locator('.product-detail-page')).toBeVisible();
  await expect(page.locator('.product-detail-fixed-action')).toBeVisible();
  await expect(page.locator('.app-shell > .bottom-nav')).toBeHidden();

  const geometry = await page.evaluate(() => {
    const topbar = document.querySelector<HTMLElement>('.app-shell > .topbar');
    const navigation = document.querySelector<HTMLElement>(
      '.product-detail-navigation',
    );
    const productPage = document.querySelector<HTMLElement>(
      '.product-detail-page',
    );
    const fixedAction = document.querySelector<HTMLElement>(
      '.product-detail-fixed-action',
    );
    const cta = fixedAction?.querySelector<HTMLElement>('.cta-button');

    const topbarRect = topbar?.getBoundingClientRect();
    const fixedActionRect = fixedAction?.getBoundingClientRect();
    const ctaRect = cta?.getBoundingClientRect();

    return {
      viewportHeight: window.innerHeight,
      topbarBottom: topbarRect?.bottom ?? 0,
      navigationStickyTop: navigation
        ? Number.parseFloat(getComputedStyle(navigation).top)
        : 0,
      fixedActionTop: fixedActionRect?.top ?? 0,
      fixedActionBottom: fixedActionRect?.bottom ?? 0,
      fixedActionHeight: fixedActionRect?.height ?? 0,
      ctaHeight: ctaRect?.height ?? 0,
      pagePaddingBottom: productPage
        ? Number.parseFloat(getComputedStyle(productPage).paddingBottom)
        : 0,
    };
  });

  expect(geometry.navigationStickyTop).toBeGreaterThanOrEqual(
    geometry.topbarBottom - 1,
  );
  expect(geometry.fixedActionTop).toBeGreaterThan(0);
  expect(geometry.fixedActionBottom).toBeLessThanOrEqual(
    geometry.viewportHeight + 1,
  );
  expect(geometry.ctaHeight).toBeGreaterThanOrEqual(50);
  expect(geometry.pagePaddingBottom).toBeGreaterThanOrEqual(
    geometry.fixedActionHeight + 8,
  );

  console.log('PRODUCT_DETAIL_FIXED_SURFACES_ACCEPTANCE=passed');
});
