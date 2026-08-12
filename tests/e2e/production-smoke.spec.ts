import { expect, test } from '@playwright/test';

test('storefront renders its shell and primary browse route without runtime errors', async ({
  page,
  request,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await expect
    .poll(
      async () => {
        const response = await request.get('/api/public/theme', {
          headers: { 'cache-control': 'no-cache' },
        });
        if (!response.ok()) return null;
        const payload = (await response.json()) as {
          theme?: { recipe?: { fontPack?: string } };
        };
        return payload.theme?.recipe?.fontPack ?? null;
      },
      { timeout: 30_000 },
    )
    .toBe('editorial');

  await page.goto('/');
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.locator('.bottom-nav')).toBeVisible();
  await expect(page.locator('.home-shortcut-icon').first()).toBeVisible();
  await expect(page.locator('.home-shortcut-zone')).toBeVisible();
  await expect(page.locator('.home-product-meta small')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.fontPack))
    .toBe('editorial');
  await expect
    .poll(() =>
      page
        .locator('.home-shortcut-icon')
        .first()
        .evaluate((element) => getComputedStyle(element).borderRadius),
    )
    .toBe('16px');

  const homeVisualContract = await page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>('.home-product-rail');
    const tiles = rail?.querySelectorAll<HTMLElement>('.home-product-tile');
    const singleTile = tiles?.length === 1 ? tiles.item(0) : null;
    const activeIcon = document.querySelector<HTMLElement>(
      '.bottom-nav a.is-active .bottom-nav-icon',
    );
    const firstCover = document.querySelector<HTMLElement>('.home-product-cover');
    const firstCoverRect = firstCover?.getBoundingClientRect();
    return {
      bodyScaleRem: Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          '--storefront-text-body',
        ),
      ),
      activeIconRadius: activeIcon ? getComputedStyle(activeIcon).borderRadius : null,
      buttonStyle: document.documentElement.dataset.buttonStyle,
      fontPack: document.documentElement.dataset.fontPack,
      mediaStyle: document.documentElement.dataset.mediaStyle,
      motionStyle: document.documentElement.dataset.motionStyle,
      navigationStyle: document.documentElement.dataset.navigationStyle,
      loadsBundledManrope: getComputedStyle(document.body).fontFamily.includes(
        'Manrope Variable',
      ),
      productCoverRatio: firstCoverRect
        ? firstCoverRect.height / firstCoverRect.width
        : null,
      singleTileStaysCompact:
        rail && singleTile
          ? singleTile.getBoundingClientRect().width <=
            rail.getBoundingClientRect().width * 0.55
          : true,
    };
  });
  expect(homeVisualContract).toEqual({
    bodyScaleRem: 0.9375,
    activeIconRadius: '0px',
    buttonStyle: 'refined',
    fontPack: 'editorial',
    mediaStyle: 'soft',
    motionStyle: 'restrained',
    navigationStyle: 'quiet',
    loadsBundledManrope: false,
    productCoverRatio: expect.any(Number),
    singleTileStaysCompact: true,
  });
  expect(homeVisualContract.productCoverRatio ?? 0).toBeCloseTo(1.25, 1);

  await page.goto('/browse/');
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.locator('.bottom-nav')).toBeVisible();
  await expect(page.locator('.browse-section-card').first()).toBeVisible();

  const navigationIndicatorState = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.bottom-nav a')].map((item) => ({
      active: item.classList.contains('is-active'),
      opacity: getComputedStyle(item, '::before').opacity,
    })),
  );
  expect(
    navigationIndicatorState
      .filter((item) => !item.active)
      .every((item) => item.opacity === '0'),
  ).toBeTruthy();

  const visualContract = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('.browse-section-card');
    const media = card?.querySelector<HTMLElement>('.browse-section-card-media');
    const image = media?.querySelector<HTMLImageElement>('img');
    const search = document.querySelector<HTMLElement>('.browse-directory-search');
    const navigation = document.querySelector<HTMLElement>('.bottom-nav');
    const cardRect = card?.getBoundingClientRect();
    const mediaRect = media?.getBoundingClientRect();
    const imageRect = image?.getBoundingClientRect();
    return {
      cardRadius: card ? getComputedStyle(card).borderRadius : null,
      cardMinHeight: cardRect?.height ?? 0,
      mediaFillsCard:
        cardRect && mediaRect
          ? Math.abs(cardRect.width - mediaRect.width) <= 1 &&
            Math.abs(cardRect.height - mediaRect.height) <= 1
          : false,
      imageFillsCard:
        !imageRect || !cardRect
          ? true
          : imageRect.width >= cardRect.width - 1 &&
            imageRect.height >= cardRect.height - 1,
      searchRadius: search ? getComputedStyle(search).borderRadius : null,
      navigationRadius: navigation ? getComputedStyle(navigation).borderRadius : null,
      navigationBottom: navigation ? getComputedStyle(navigation).bottom : null,
    };
  });
  expect(visualContract).toEqual({
    cardRadius: '14px',
    cardMinHeight: expect.any(Number),
    mediaFillsCard: true,
    imageFillsCard: true,
    searchRadius: '14px',
    navigationRadius: '0px',
    navigationBottom: '0px',
  });
  expect(visualContract.cardMinHeight).toBeGreaterThanOrEqual(220);

  const sectionHref = await page
    .locator('a[href^="/sections/"]:not([href*="/products/"])')
    .first()
    .getAttribute('href');
  expect(sectionHref).toBeTruthy();
  await page.goto(sectionHref!);
  await expect(page.locator('.section-catalog-back')).toBeVisible();
  await expect(page.locator('.section-catalog-content')).toBeVisible();
  await expect(page.locator('.section-category-filter button').first()).toHaveText('All');
  await expect(page.locator('.section-category-select')).toHaveCount(0);
  await expect(page.locator('.section-product-meta small')).toHaveCount(0);

  const categoryButtons = page.locator('.section-category-filter button');
  if ((await categoryButtons.count()) > 1) {
    await categoryButtons.nth(1).click();
    await expect(categoryButtons.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await categoryButtons.first().click();
    await expect(categoryButtons.first()).toHaveAttribute('aria-pressed', 'true');
  }

  const sectionAppContract = await page.evaluate(() => {
    const back = document.querySelector<HTMLElement>('.section-catalog-back');
    const content = document.querySelector<HTMLElement>('.section-catalog-content');
    const main = document.querySelector<HTMLElement>('.app-shell > main');
    const topbar = document.querySelector<HTMLElement>('.app-shell > .topbar');
    const backRect = back?.getBoundingClientRect();
    const backIconRect = back?.querySelector('svg')?.getBoundingClientRect();
    const backLabelRect = back
      ?.querySelector<HTMLElement>('.section-catalog-back-label')
      ?.getBoundingClientRect();
    return {
      documentLocked:
        document.scrollingElement !== null &&
        document.scrollingElement.scrollHeight <=
          document.scrollingElement.clientHeight + 1,
      bodyOverflow: getComputedStyle(document.body).overflow,
      mainOverflow: main ? getComputedStyle(main).overflow : null,
      contentOverflowY: content ? getComputedStyle(content).overflowY : null,
      backWidth: backRect?.width ?? 0,
      backHeight: backRect?.height ?? 0,
      backRadius: back ? getComputedStyle(back).borderRadius : null,
      backBorderWidth: back ? getComputedStyle(back).borderTopWidth : null,
      backBackground: back ? getComputedStyle(back).backgroundColor : null,
      backSingleLine:
        backIconRect && backLabelRect
          ? Math.abs(
              backIconRect.top +
                backIconRect.height / 2 -
                (backLabelRect.top + backLabelRect.height / 2),
            ) <= 1
          : false,
      topbarHidden: topbar ? getComputedStyle(topbar).display === 'none' : false,
    };
  });
  expect(sectionAppContract).toEqual({
    documentLocked: true,
    bodyOverflow: 'hidden',
    mainOverflow: 'hidden',
    contentOverflowY: 'auto',
    backWidth: expect.any(Number),
    backHeight: 44,
    backRadius: '0px',
    backBorderWidth: '0px',
    backBackground: 'rgba(0, 0, 0, 0)',
    backSingleLine: true,
    topbarHidden: true,
  });
  expect(sectionAppContract.backWidth).toBeGreaterThan(44);
  expect(pageErrors).toEqual([]);
});

test('manifest exposes installable, branded PNG icons', async ({ request }) => {
  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBeTruthy();
  expect(manifestResponse.headers()['content-type']).toContain(
    'application/manifest+json',
  );

  const manifest = (await manifestResponse.json()) as {
    name?: string;
    icons?: Array<{ src?: string; sizes?: string; type?: string }>;
  };
  expect(manifest.name).toBeTruthy();
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        src: '/api/public/pwa/icon/192',
        sizes: '192x192',
        type: 'image/png',
      }),
      expect.objectContaining({
        src: '/api/public/pwa/icon/512',
        sizes: '512x512',
        type: 'image/png',
      }),
    ]),
  );

  for (const size of [192, 512]) {
    const iconResponse = await request.get(`/api/public/pwa/icon/${size}`);
    expect(iconResponse.ok()).toBeTruthy();
    expect(iconResponse.headers()['content-type']).toContain('image/png');
    expect((await iconResponse.body()).byteLength).toBeGreaterThan(1_000);
  }
});

test('admin entry renders the authentication boundary', async ({ page }) => {
  await page.goto('/admin/');
  await expect(page.locator('#admin-password')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test('messages route explains when customer service is not configured', async ({
  page,
  request,
}) => {
  const supportResponse = await request.get('/api/public/storefront/support/connections');
  expect(supportResponse.ok()).toBeTruthy();
  const support = (await supportResponse.json()) as { connections?: unknown[] };

  await page.goto('/messages/');
  await expect(page.locator('#root')).not.toBeEmpty();
  if (!support.connections?.length) {
    await expect(page.getByText('No support available')).toBeVisible();
  }
});

test('a published product always renders its CTA surface', async ({ page }) => {
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
  const productBack = page.locator('.product-detail-back');
  await expect(productBack.locator('.product-detail-back-label')).toBeVisible();
  await expect
    .poll(() =>
      productBack.evaluate((element) => {
        const iconRect = element.querySelector('svg')?.getBoundingClientRect();
        const labelRect = element
          .querySelector<HTMLElement>('.product-detail-back-label')
          ?.getBoundingClientRect();
        return iconRect && labelRect
          ? Math.abs(
              iconRect.top + iconRect.height / 2 - (labelRect.top + labelRect.height / 2),
            ) <= 1
          : false;
      }),
    )
    .toBe(true);
  const cta = page.locator('.product-detail-fixed-action .cta-button');
  await expect(cta).toBeVisible();
  await expect
    .poll(() => cta.evaluate((element) => element.getBoundingClientRect().height))
    .toBeGreaterThanOrEqual(52);
});
