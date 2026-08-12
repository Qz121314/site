import { expect, test } from '@playwright/test';

test('storefront renders its shell and primary browse route without runtime errors', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.locator('.bottom-nav')).toBeVisible();
  await expect(page.locator('.home-shortcut-icon').first()).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('.home-shortcut-icon')
        .first()
        .evaluate((element) => getComputedStyle(element).borderRadius),
    )
    .toBe('12px');

  const homeVisualContract = await page.evaluate(() => {
    const singleRail = document.querySelector<HTMLElement>(
      '.home-product-rail.is-single',
    );
    const singleTile = singleRail?.querySelector<HTMLElement>('.home-product-tile');
    const activeIcon = document.querySelector<HTMLElement>(
      '.bottom-nav a.is-active .bottom-nav-icon',
    );
    return {
      bodyScaleRem: Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          '--storefront-text-body',
        ),
      ),
      activeIconRadius: activeIcon ? getComputedStyle(activeIcon).borderRadius : null,
      singleTileFillsRail:
        singleRail && singleTile
          ? singleTile.getBoundingClientRect().width >=
            singleRail.getBoundingClientRect().width * 0.95
          : true,
    };
  });
  expect(homeVisualContract).toEqual({
    bodyScaleRem: 0.9375,
    activeIconRadius: '10px',
    singleTileFillsRail: true,
  });

  await page.goto('/browse/');
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.locator('.bottom-nav')).toBeVisible();
  await expect(page.locator('.browse-section-card').first()).toBeVisible();

  const visualContract = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('.browse-section-card');
    const search = document.querySelector<HTMLElement>('.browse-directory-search');
    const navigation = document.querySelector<HTMLElement>('.bottom-nav');
    return {
      cardRadius: card ? getComputedStyle(card).borderRadius : null,
      searchRadius: search ? getComputedStyle(search).borderRadius : null,
      navigationRadius: navigation ? getComputedStyle(navigation).borderRadius : null,
      navigationBottom: navigation ? getComputedStyle(navigation).bottom : null,
    };
  });
  expect(visualContract).toEqual({
    cardRadius: '0px',
    searchRadius: '3px',
    navigationRadius: '0px',
    navigationBottom: '0px',
  });
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
  const cta = page.locator('.product-detail-fixed-action .cta-button');
  await expect(cta).toBeVisible();
  await expect
    .poll(() => cta.evaluate((element) => element.getBoundingClientRect().height))
    .toBeGreaterThanOrEqual(52);
});
