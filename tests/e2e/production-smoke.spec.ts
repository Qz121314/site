import { expect, test, type Page } from '@playwright/test';
import {
  findPublishedProductRoute,
  findPublishedSectionRoute,
} from './published-storefront-fixtures';

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}

test('storefront applies the current admin theme and keeps discovery routes healthy', async ({
  page,
  request,
}) => {
  const themeResponse = await request.get('/api/public/theme', {
    headers: { 'cache-control': 'no-cache' },
  });
  expect(themeResponse.ok()).toBeTruthy();

  const payload = (await themeResponse.json()) as {
    theme?: {
      recipe?: {
        buttonStyle?: string;
        fontPack?: string;
        mediaStyle?: string;
        motionStyle?: string;
        navigationStyle?: string;
      };
    };
  };
  const recipe = payload.theme?.recipe;
  if (!recipe) throw new Error('Public theme recipe is missing');

  const publishedSection = await findPublishedSectionRoute(request);
  test.skip(
    !publishedSection,
    'No published section is available for production acceptance.',
  );

  await page.goto('/');
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.locator('.app-shell > .topbar .brand-lockup')).toBeVisible();
  await expect(page.locator('.storefront-bottom-chrome > .bottom-nav')).toBeVisible();
  await expect(page.locator('.home-shortcut-zone')).toBeVisible();

  await expect
    .poll(() =>
      page.evaluate(() => ({
        buttonStyle: document.documentElement.dataset.buttonStyle,
        fontPack: document.documentElement.dataset.fontPack,
        mediaStyle: document.documentElement.dataset.mediaStyle,
        motionStyle: document.documentElement.dataset.motionStyle,
        navigationStyle: document.documentElement.dataset.navigationStyle,
      })),
    )
    .toEqual({
      buttonStyle: recipe.buttonStyle,
      fontPack: recipe.fontPack,
      mediaStyle: recipe.mediaStyle,
      motionStyle: recipe.motionStyle,
      navigationStyle: recipe.navigationStyle,
    });
  await expectNoHorizontalOverflow(page);

  await page.goto('/browse/');
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.locator('.storefront-bottom-chrome > .bottom-nav')).toBeVisible();
  await expect(page.locator('.browse-directory-search')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto(publishedSection!.sectionHref);
  await expect(page.locator('.section-catalog-back')).toBeVisible();
  await expect(page.locator('.section-catalog-content')).toBeVisible();
  await expect(page.locator('.section-catalog-search')).toBeVisible();
  await expect(page.locator('.section-category-filter button').first()).toHaveText('All');

  const sectionContract = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>('.section-catalog-content');
    const search = document.querySelector<HTMLElement>('.section-catalog-search');
    const cover = document.querySelector<HTMLElement>('.section-product-cover');
    const searchRect = search?.getBoundingClientRect();
    const coverRect = cover?.getBoundingClientRect();
    return {
      bodyOverflow: getComputedStyle(document.body).overflow,
      contentOverflowY: content ? getComputedStyle(content).overflowY : null,
      searchHeight: searchRect?.height ?? 0,
      coverRatio: coverRect ? coverRect.height / coverRect.width : null,
    };
  });

  expect(sectionContract.bodyOverflow).toBe('hidden');
  expect(sectionContract.contentOverflowY).toBe('auto');
  expect(sectionContract.searchHeight).toBeGreaterThanOrEqual(44);
  if (sectionContract.coverRatio !== null) {
    expect(sectionContract.coverRatio).toBeCloseTo(1, 2);
  }
  await expectNoHorizontalOverflow(page);
});

test('manifest exposes installable branded PNG icons', async ({ request }) => {
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

test('messages route remains renderable with the current support configuration', async ({
  page,
  request,
}) => {
  const supportResponse = await request.get('/api/public/storefront/support/connections');
  expect(supportResponse.ok()).toBeTruthy();

  await page.goto('/messages/');
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.locator('.messages-workspace')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('a published product keeps shell chrome inside the live visual viewport', async ({
  page,
  request,
}) => {
  const publishedRoute = await findPublishedProductRoute(request);
  test.skip(!publishedRoute, 'No published product is available for CTA verification.');

  await page.goto(publishedRoute!.productHref);
  const header = page.locator('.app-shell > .storefront-detail-topbar');
  const bottomChrome = page.locator('.app-shell > .storefront-bottom-chrome');
  const actionHost = page.locator(
    '.storefront-bottom-chrome > .storefront-route-action-host',
  );
  const routeAction = actionHost.locator('.product-detail-route-action');
  const cta = routeAction.locator('.cta-button');
  const mobileMediaTrack = page.locator('.detail-mobile-media-track');

  await expect(header).toBeVisible();
  await expect(header.locator('.storefront-detail-back')).toBeVisible();
  await expect(bottomChrome).toBeVisible();
  await expect(actionHost).toBeVisible();
  await expect(routeAction).toBeVisible();
  await expect(cta).toBeVisible();
  await expect(page.locator('.product-detail-navigation')).toHaveCount(0);
  await expect(page.locator('.product-detail-secondary-media')).toHaveCount(0);
  await expect(page.locator('.app-shell > .storefront-route-action-host')).toHaveCount(0);
  await expect(
    page.locator('.storefront-route-view .storefront-route-action-host'),
  ).toHaveCount(0);

  if ((await mobileMediaTrack.count()) > 0) {
    await expect(mobileMediaTrack).toBeVisible();
    const mediaContract = await mobileMediaTrack.evaluate((element) => ({
      overflowX: getComputedStyle(element).overflowX,
      scrollSnapType: getComputedStyle(element).scrollSnapType,
    }));
    expect(mediaContract.overflowX).toBe('auto');
    expect(mediaContract.scrollSnapType).toContain('x');
  }

  const chromeContract = await page.evaluate(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const visualTop = viewport?.offsetTop ?? 0;
    const visualHeight = viewport?.height ?? window.innerHeight;
    const visualBottom = visualTop + visualHeight;
    const headerElement = document.querySelector<HTMLElement>(
      '.storefront-detail-topbar',
    );
    const bottomChromeElement = document.querySelector<HTMLElement>(
      '.storefront-bottom-chrome',
    );
    const host = bottomChromeElement?.querySelector<HTMLElement>(
      '.storefront-route-action-host',
    );
    const button = host?.querySelector<HTMLElement>('.cta-button');
    const headerRect = headerElement?.getBoundingClientRect();
    const bottomChromeRect = bottomChromeElement?.getBoundingClientRect();
    const cssNumber = (name: string) =>
      Number.parseFloat(root.style.getPropertyValue(name)) || 0;

    return {
      viewportRuntime: root.dataset.visualViewport,
      runtimeViewportHeight: cssNumber('--app-viewport-height'),
      visualHeight,
      headerContract: {
        position: headerElement ? getComputedStyle(headerElement).position : null,
        visualTopGap: headerRect ? Math.abs(headerRect.top - visualTop) : Infinity,
        runtimeHeightGap: headerRect
          ? Math.abs(cssNumber('--app-header-height') - headerRect.height)
          : Infinity,
      },
      ctaContract: {
        chromePosition: bottomChromeElement
          ? getComputedStyle(bottomChromeElement).position
          : null,
        visualBottomGap: bottomChromeRect
          ? Math.abs(visualBottom - bottomChromeRect.bottom)
          : Infinity,
        runtimeHeightGap: bottomChromeRect
          ? Math.abs(cssNumber('--app-bottom-chrome-height') - bottomChromeRect.height)
          : Infinity,
        buttonHeight: button?.getBoundingClientRect().height ?? 0,
      },
    };
  });

  const { headerContract, ctaContract } = chromeContract;
  expect(chromeContract.viewportRuntime).toBeTruthy();
  expect(
    Math.abs(chromeContract.runtimeViewportHeight - chromeContract.visualHeight),
  ).toBeLessThanOrEqual(1.5);
  expect(headerContract.position).toBe('fixed');
  expect(headerContract.visualTopGap).toBeLessThanOrEqual(1.5);
  expect(headerContract.runtimeHeightGap).toBeLessThanOrEqual(1.5);
  expect(ctaContract.chromePosition).toBe('fixed');
  expect(ctaContract.visualBottomGap).toBeLessThanOrEqual(1.5);
  expect(ctaContract.runtimeHeightGap).toBeLessThanOrEqual(1.5);
  expect(ctaContract.buttonHeight).toBeGreaterThanOrEqual(44);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect
    .poll(() =>
      bottomChrome.evaluate((element) => {
        const viewport = window.visualViewport;
        const visualBottom =
          (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
        return Math.abs(visualBottom - element.getBoundingClientRect().bottom);
      }),
    )
    .toBeLessThanOrEqual(1.5);
});
