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
    const response = await request.get(`/api/public/pwa/icon/${size}`);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('image/png');
    expect(response.headers()['cache-control']).toContain('public');
  }
});

test('admin renders the login entry without page errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/admin/');
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('public discovery endpoints are readable', async ({ request }) => {
  const [themeResponse, currentResponse] = await Promise.all([
    request.get('/api/public/theme'),
    request.get('/public/current.json'),
  ]);
  expect(themeResponse.ok()).toBeTruthy();
  expect(currentResponse.ok()).toBeTruthy();
});

test('health endpoint reports the deployed production worker', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    ok?: boolean;
    environment?: string;
    publicLanguage?: string;
    workerVersionId?: string;
  };
  expect(payload.ok).toBe(true);
  expect(payload.environment).toBe('production');
  expect(payload.publicLanguage).toBe('en');
  expect(payload.workerVersionId).toBeTruthy();
});
