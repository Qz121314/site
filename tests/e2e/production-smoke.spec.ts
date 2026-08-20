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

test('storefront keeps one coherent mobile visual system across discovery routes', async ({
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
  await expect(page.locator('.app-shell > .topbar .brand-lockup')).toBeVisible();
  await expect(page.locator('.bottom-nav')).toBeVisible();
  await expect(page.locator('.home-shortcut-icon').first()).toBeVisible();
  await expect(page.locator('.home-shortcut-zone')).toBeVisible();
  await expect(page.locator('.home-product-meta small')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.fontPack))
    .toBe('editorial');

  const homeVisualContract = await page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>('.home-product-rail');
    const tiles = rail?.querySelectorAll<HTMLElement>('.home-product-tile');
    const singleTile = tiles?.length === 1 ? tiles.item(0) : null;
    const shortcut = document.querySelector<HTMLElement>('.home-shortcut-icon');
    const activeIcon = document.querySelector<HTMLElement>(
      '.bottom-nav a.is-active .bottom-nav-icon',
    );
    const navigation = document.querySelector<HTMLElement>('.bottom-nav');
    const firstCover = document.querySelector<HTMLElement>('.home-product-cover');
    const firstCoverRect = firstCover?.getBoundingClientRect();
    const semanticHeading = document.querySelector<HTMLElement>(
      '.home-feed > h1.sr-only',
    );
    const semanticHeadingRect = semanticHeading?.getBoundingClientRect();
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
      shortcutRadius: shortcut
        ? Number.parseFloat(getComputedStyle(shortcut).borderRadius)
        : null,
      shortcutShadow: shortcut ? getComputedStyle(shortcut).boxShadow : null,
      productCoverRadius: firstCover
        ? Number.parseFloat(getComputedStyle(firstCover).borderRadius)
        : null,
      productCoverShadow: firstCover ? getComputedStyle(firstCover).boxShadow : null,
      productCoverRatio: firstCoverRect
        ? firstCoverRect.height / firstCoverRect.width
        : null,
      navigationRadius: navigation ? getComputedStyle(navigation).borderRadius : null,
      navigationBottom: navigation ? getComputedStyle(navigation).bottom : null,
      semanticBrandHeadingHidden:
        semanticHeadingRect !== undefined &&
        semanticHeadingRect !== null &&
        semanticHeadingRect.width <= 1 &&
        semanticHeadingRect.height <= 1,
      singleTileStaysCompact:
        rail && singleTile
          ? singleTile.getBoundingClientRect().width <=
            rail.getBoundingClientRect().width * 0.55
          : true,
    };
  });

  expect(homeVisualContract).toMatchObject({
    bodyScaleRem: 0.9375,
    activeIconRadius: '0px',
    buttonStyle: 'refined',
    fontPack: 'editorial',
    mediaStyle: 'soft',
    motionStyle: 'restrained',
    navigationStyle: 'quiet',
    loadsBundledManrope: false,
    shortcutShadow: 'none',
    productCoverShadow: 'none',
    navigationRadius: '0px',
    navigationBottom: '0px',
    semanticBrandHeadingHidden: true,
    singleTileStaysCompact: true,
  });
  expect(homeVisualContract.shortcutRadius ?? 99).toBeGreaterThan(0);
  expect(homeVisualContract.shortcutRadius ?? 99).toBeLessThanOrEqual(12);
  expect(homeVisualContract.productCoverRatio ?? 0).toBeCloseTo(1, 2);
  await expectNoHorizontalOverflow(page);

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

  const browseVisualContract = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('.browse-section-card');
    const media = card?.querySelector<HTMLElement>('.browse-section-card-media');
    const image = media?.querySelector<HTMLImageElement>('img');
    const search = document.querySelector<HTMLElement>('.browse-directory-search');
    const navigation = document.querySelector<HTMLElement>('.bottom-nav');
    const semanticHeading = document.querySelector<HTMLElement>(
      '.browse-directory > h1.sr-only',
    );
    const cardRect = card?.getBoundingClientRect();
    const mediaRect = media?.getBoundingClientRect();
    const imageRect = image?.getBoundingClientRect();
    const searchRect = search?.getBoundingClientRect();
    const semanticHeadingRect = semanticHeading?.getBoundingClientRect();
    return {
      cardRadius: card ? Number.parseFloat(getComputedStyle(card).borderRadius) : null,
      cardShadow: card ? getComputedStyle(card).boxShadow : null,
      cardMinHeight: cardRect?.height ?? 0,
      cardRatio: cardRect ? cardRect.height / cardRect.width : null,
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
      semanticBrandHeadingHidden:
        semanticHeadingRect !== undefined &&
        semanticHeadingRect !== null &&
        semanticHeadingRect.width <= 1 &&
        semanticHeadingRect.height <= 1,
      searchRadius: search
        ? Number.parseFloat(getComputedStyle(search).borderRadius)
        : null,
      searchHeight: searchRect?.height ?? 0,
      searchShadow: search ? getComputedStyle(search).boxShadow : null,
      navigationRadius: navigation ? getComputedStyle(navigation).borderRadius : null,
      navigationBottom: navigation ? getComputedStyle(navigation).bottom : null,
    };
  });

  expect(browseVisualContract).toMatchObject({
    cardShadow: 'none',
    mediaFillsCard: true,
    imageFillsCard: true,
    semanticBrandHeadingHidden: true,
    searchShadow: 'none',
    navigationRadius: '0px',
    navigationBottom: '0px',
  });
  expect(browseVisualContract.cardRadius ?? 99).toBeLessThanOrEqual(12);
  expect(browseVisualContract.cardMinHeight).toBeGreaterThanOrEqual(180);
  expect(browseVisualContract.cardRatio ?? 0).toBeCloseTo(10 / 16, 1);
  expect(browseVisualContract.searchRadius ?? 99).toBeGreaterThan(0);
  expect(browseVisualContract.searchRadius ?? 99).toBeLessThanOrEqual(12);
  expect(browseVisualContract.searchHeight).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalOverflow(page);

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

  const sectionVisualContract = await page.evaluate(() => {
    const back = document.querySelector<HTMLElement>('.section-catalog-back');
    const content = document.querySelector<HTMLElement>('.section-catalog-content');
    const main = document.querySelector<HTMLElement>('.app-shell > main');
    const topbar = document.querySelector<HTMLElement>('.app-shell > .topbar');
    const search = document.querySelector<HTMLElement>('.section-catalog-search');
    const productCover = document.querySelector<HTMLElement>('.section-product-cover');
    const backRect = back?.getBoundingClientRect();
    const backIconRect = back?.querySelector('svg')?.getBoundingClientRect();
    const backLabelRect = back
      ?.querySelector<HTMLElement>('.section-catalog-back-label')
      ?.getBoundingClientRect();
    const searchRect = search?.getBoundingClientRect();
    const productCoverRect = productCover?.getBoundingClientRect();
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
      searchRadius: search
        ? Number.parseFloat(getComputedStyle(search).borderRadius)
        : null,
      searchHeight: searchRect?.height ?? 0,
      searchShadow: search ? getComputedStyle(search).boxShadow : null,
      productCoverRadius: productCover
        ? Number.parseFloat(getComputedStyle(productCover).borderRadius)
        : null,
      productCoverRatio: productCoverRect
        ? productCoverRect.height / productCoverRect.width
        : null,
      productCoverShadow: productCover ? getComputedStyle(productCover).boxShadow : null,
      topbarHidden: topbar ? getComputedStyle(topbar).display === 'none' : false,
    };
  });

  expect(sectionVisualContract).toMatchObject({
    documentLocked: true,
    bodyOverflow: 'hidden',
    mainOverflow: 'hidden',
    contentOverflowY: 'auto',
    backHeight: 44,
    backRadius: '0px',
    backBorderWidth: '0px',
    backBackground: 'rgba(0, 0, 0, 0)',
    backSingleLine: true,
    searchShadow: 'none',
    topbarHidden: false,
  });
  expect(sectionVisualContract.backWidth).toBeGreaterThan(44);
  expect(
    Math.abs(sectionVisualContract.searchHeight - browseVisualContract.searchHeight),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(
      (sectionVisualContract.searchRadius ?? 0) -
        (browseVisualContract.searchRadius ?? 0),
    ),
  ).toBeLessThanOrEqual(0.5);
  if (sectionVisualContract.productCoverRatio !== null) {
    expect(sectionVisualContract.productCoverRatio).toBeCloseTo(1, 2);
    expect(sectionVisualContract.productCoverShadow).toBe('none');
    expect(
      Math.abs(
        (sectionVisualContract.productCoverRadius ?? 0) -
          (homeVisualContract.productCoverRadius ?? 0),
      ),
    ).toBeLessThanOrEqual(0.5);
  }
  await expectNoHorizontalOverflow(page);
  expect(pageErrors).toEqual([]);
});

test('FAQ keeps its semantic title out of the visual brand surface', async ({ page }) => {
  await page.goto('/faq/');
  await expect(page.locator('.app-shell > .topbar .brand-lockup')).toBeVisible();
  await expect
    .poll(() =>
      page.locator('.faq-directory > h1.sr-only').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width <= 1 && rect.height <= 1;
      }),
    )
    .toBe(true);
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

test('admin entry renders the authentication boundary from /admin', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/$/u);
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

test('a published product always renders its mobile CTA surface', async ({ page }) => {
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
  await expect(productBack).toBeVisible();
  await expect(productBack.locator('svg')).toBeVisible();
  await expect(productBack.locator('.product-detail-back-label')).toBeHidden();

  const backContract = await productBack.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      radius: getComputedStyle(element).borderRadius,
    };
  });
  expect(backContract.width).toBe(40);
  expect(backContract.height).toBe(40);
  expect(backContract.radius).toBe('50%');

  const fixedAction = page.locator('body > .product-detail-fixed-action');
  const cta = fixedAction.locator('.cta-button');
  await expect(fixedAction).toBeVisible();
  await expect(cta).toBeVisible();
  await expect
    .poll(() => fixedAction.evaluate((element) => getComputedStyle(element).position))
    .toBe('fixed');
  await expect
    .poll(() => cta.evaluate((element) => element.getBoundingClientRect().height))
    .toBeGreaterThanOrEqual(52);
});
