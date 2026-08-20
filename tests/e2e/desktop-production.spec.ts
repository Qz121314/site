import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}

test('desktop shell keeps the centered brand and primary navigation usable', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.locator('.app-shell > .topbar .brand-lockup')).toBeVisible();
  await expect(page.locator('.app-shell > .bottom-nav')).toBeVisible();

  const shellContract = await page.evaluate(() => {
    const topbar = document.querySelector<HTMLElement>('.app-shell > .topbar');
    const brand = topbar?.querySelector<HTMLElement>('.brand-lockup');
    const navigation = document.querySelector<HTMLElement>('.app-shell > .bottom-nav');
    const topbarRect = topbar?.getBoundingClientRect();
    const brandRect = brand?.getBoundingClientRect();
    const navigationRect = navigation?.getBoundingClientRect();
    return {
      brandCenterDelta: brandRect
        ? Math.abs(brandRect.left + brandRect.width / 2 - window.innerWidth / 2)
        : Number.POSITIVE_INFINITY,
      navigationPosition: navigation ? getComputedStyle(navigation).position : null,
      navigationInsideTopbar:
        Boolean(topbarRect && navigationRect) &&
        navigationRect!.top >= topbarRect!.top - 1 &&
        navigationRect!.bottom <= topbarRect!.bottom + 1,
      navigationClearsBrand:
        Boolean(brandRect && navigationRect) && navigationRect!.left >= brandRect!.right + 12,
    };
  });

  expect(shellContract.navigationPosition).toBe('fixed');
  expect(shellContract.brandCenterDelta).toBeLessThanOrEqual(1.5);
  expect(shellContract.navigationInsideTopbar).toBeTruthy();
  expect(shellContract.navigationClearsBrand).toBeTruthy();
  await expectNoHorizontalOverflow(page);

  await page.goto('/browse/');
  await expect(page.locator('.browse-directory')).toBeVisible();
  await expect(page.locator('.app-shell > .bottom-nav')).toBeVisible();

  const browseCards = page.locator('.browse-section-card');
  if ((await browseCards.count()) >= 2) {
    const layout = await browseCards
      .evaluateAll((cards) =>
        cards.slice(0, 2).map((card) => {
          const rect = card.getBoundingClientRect();
          return { left: rect.left, top: rect.top, width: rect.width };
        }),
      );
    expect(Math.abs(layout[0]!.top - layout[1]!.top)).toBeLessThanOrEqual(1);
    expect(layout[1]!.left).toBeGreaterThan(layout[0]!.left);
    expect(layout[0]!.width).toBeGreaterThan(280);
    expect(layout[1]!.width).toBeGreaterThan(280);
  }

  await expectNoHorizontalOverflow(page);
  expect(pageErrors).toEqual([]);
});

test('desktop section and product detail use the PC decision layout', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/browse/');
  const sectionHref = await page
    .locator('a[href^="/sections/"]:not([href*="/products/"])')
    .first()
    .getAttribute('href');
  test.skip(!sectionHref, 'No published section is available for desktop acceptance.');

  await page.goto(sectionHref!);
  await expect(page.locator('.section-catalog')).toBeVisible();
  await expect(page.locator('.app-shell > .topbar')).toBeVisible();

  const sectionContract = await page.evaluate(() => ({
    bodyOverflow: getComputedStyle(document.body).overflow,
    documentScrollable:
      document.scrollingElement !== null &&
      document.scrollingElement.scrollHeight >= document.scrollingElement.clientHeight,
  }));
  expect(sectionContract.bodyOverflow).not.toBe('hidden');
  expect(sectionContract.documentScrollable).toBeTruthy();

  const productCards = page.locator('.section-product-card');
  if ((await productCards.count()) >= 2) {
    const layout = await productCards
      .evaluateAll((cards) =>
        cards.slice(0, 2).map((card) => {
          const rect = card.getBoundingClientRect();
          const cover = card.querySelector<HTMLElement>('.section-product-cover');
          const coverRect = cover?.getBoundingClientRect();
          return {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            coverRatio: coverRect ? coverRect.height / coverRect.width : null,
          };
        }),
      );
    expect(Math.abs(layout[0]!.top - layout[1]!.top)).toBeLessThanOrEqual(1);
    expect(layout[1]!.left).toBeGreaterThan(layout[0]!.left);
    expect(layout[0]!.coverRatio ?? 0).toBeCloseTo(1, 2);
    expect(layout[1]!.coverRatio ?? 0).toBeCloseTo(1, 2);
  }

  const productHref = await productCards.first().getAttribute('href');
  test.skip(!productHref, 'No published product is available for desktop acceptance.');

  await page.goto(productHref!);
  await expect(page.locator('.product-detail-page')).toBeVisible();
  await expect(page.locator('.detail-desktop-gallery')).toBeVisible();
  await expect(page.locator('.detail-mobile-gallery')).toBeHidden();
  await expect(page.locator('.product-detail-inline-action .cta-button')).toBeVisible();
  await expect(page.locator('body > .product-detail-fixed-action')).toBeHidden();

  const detailContract = await page.evaluate(() => {
    const gallery = document.querySelector<HTMLElement>('.detail-gallery');
    const info = document.querySelector<HTMLElement>('.product-detail-info');
    const galleryRect = gallery?.getBoundingClientRect();
    const infoRect = info?.getBoundingClientRect();
    return {
      sideBySide:
        Boolean(galleryRect && infoRect) && infoRect!.left >= galleryRect!.right + 20,
      infoWidth: infoRect?.width ?? 0,
    };
  });
  expect(detailContract.sideBySide).toBeTruthy();
  expect(detailContract.infoWidth).toBeGreaterThanOrEqual(280);
  await expectNoHorizontalOverflow(page);
  expect(pageErrors).toEqual([]);
});

test('desktop Messages and FAQ remain healthy without horizontal overflow', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/messages/');
  await expect(page.locator('.messages-workspace')).toBeVisible();
  await expect(page.locator('.messages-sidebar')).toBeVisible();
  await expect(page.locator('.messages-detail')).toBeVisible();

  const messagesContract = await page
    .locator('.messages-workspace')
    .evaluate((workspace) => {
      const sidebar = workspace.querySelector<HTMLElement>('.messages-sidebar');
      return {
        gridTemplateColumns: getComputedStyle(workspace).gridTemplateColumns,
        sidebarWidth: sidebar?.getBoundingClientRect().width ?? 0,
      };
    });
  expect(messagesContract.gridTemplateColumns).not.toBe('none');
  expect(messagesContract.sidebarWidth).toBeGreaterThanOrEqual(300);
  expect(messagesContract.sidebarWidth).toBeLessThanOrEqual(380);
  await expectNoHorizontalOverflow(page);

  await page.goto('/faq/');
  await expect(page.locator('.faq-directory')).toBeVisible();
  await expect(page.locator('.app-shell > .topbar .brand-lockup')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(pageErrors).toEqual([]);
});
