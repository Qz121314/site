import { expect, test, type Locator } from '@playwright/test';

type SupportConnectionsResponse = {
  connections?: unknown[];
};

type PublicCtaResponse = {
  available?: boolean;
  mode?: 'customer_service' | 'link';
  path?: string;
};

async function expectLoadedImage(locator: Locator) {
  await expect
    .poll(() =>
      locator.evaluate((element) => {
        const image = element as HTMLImageElement;
        return image.complete && image.naturalWidth > 0;
      }),
    )
    .toBe(true);
}

test('messages page stays healthy against production support without creating conversations', async ({
  page,
  request,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const supportResponse = await request.get(
    '/api/public/storefront/support/connections',
    {
      headers: { 'cache-control': 'no-cache' },
    },
  );
  expect(supportResponse.ok()).toBeTruthy();
  const support = (await supportResponse.json()) as SupportConnectionsResponse;
  expect(Array.isArray(support.connections)).toBeTruthy();

  await page.goto('/messages/');
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.locator('.messages-page')).toBeVisible();

  if (!support.connections?.length) {
    await expect(page.getByText('No support available')).toBeVisible();
    expect(pageErrors).toEqual([]);
    console.log('MESSAGES_PAGE_ACCEPTANCE=passed:no-support-configured');
    return;
  }

  await expect(page.getByText('No support available')).toHaveCount(0);
  await expect(page.locator('.messages-empty-state, .conversation-list')).toHaveCount(1);

  const firstConversation = page.locator('.conversation-row').first();
  if ((await firstConversation.count()) > 0) {
    await expect(firstConversation).toHaveAttribute('href', /^\/messages\/.+\/$/u);
    const avatarImage = firstConversation.locator('.conversation-avatar img');
    if ((await avatarImage.count()) > 0) await expectLoadedImage(avatarImage);
  }

  expect(pageErrors).toEqual([]);
  console.log('MESSAGES_PAGE_ACCEPTANCE=passed');
});

test('a published customer-service CTA reaches the product-scoped Messages composer', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);

  const supportResponse = await request.get(
    '/api/public/storefront/support/connections',
    {
      headers: { 'cache-control': 'no-cache' },
    },
  );
  expect(supportResponse.ok()).toBeTruthy();
  const support = (await supportResponse.json()) as SupportConnectionsResponse;
  test.skip(
    !support.connections?.length,
    'Customer service is not configured in production.',
  );

  await page.route('**/go/**', (route) => route.abort('blockedbyclient'));
  await page.goto('/browse/');

  const sectionHrefs = await page
    .locator('a[href^="/sections/"]:not([href*="/products/"])')
    .evaluateAll((links) => {
      const hrefs = links.map((link) => link.getAttribute('href')).filter(Boolean);
      return [...new Set(hrefs)];
    });

  let customerServiceCtaFound = false;

  for (const sectionHref of sectionHrefs) {
    if (!sectionHref) continue;
    await page.goto(sectionHref);
    const productHrefs = await page
      .locator('a.section-product-card[href*="/products/"]')
      .evaluateAll((links) => {
        const hrefs = links.map((link) => link.getAttribute('href')).filter(Boolean);
        return [...new Set(hrefs)];
      });

    for (const productHref of productHrefs) {
      if (!productHref) continue;
      await page.goto(productHref);
      const cta = page.locator('.product-detail-fixed-action .cta-button');
      await expect(cta).toBeVisible();

      const productImage = page.locator('.detail-mobile-media-item img').first();
      const productImageSrc =
        (await productImage.count()) > 0 ? await productImage.getAttribute('src') : null;

      const ctaResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname.startsWith('/api/public/storefront/cta/'),
      );
      await cta.click({ noWaitAfter: true });
      const ctaResponse = await ctaResponsePromise;
      if (!ctaResponse.ok()) continue;

      const result = (await ctaResponse.json()) as PublicCtaResponse;
      if (
        result.available !== true ||
        result.mode !== 'customer_service' ||
        typeof result.path !== 'string'
      ) {
        continue;
      }

      await expect
        .poll(() => {
          const url = new URL(page.url());
          return `${url.pathname}${url.search}`;
        })
        .toBe(result.path);

      const composerUrl = new URL(page.url());
      expect(composerUrl.pathname).toMatch(/^\/messages\/new\/?$/u);
      expect(composerUrl.searchParams.get('productId')).toBeTruthy();
      expect(composerUrl.searchParams.get('sectionId')).toBeTruthy();
      await expect(page.locator('.chat-page')).toBeVisible();
      await expect(page.locator('.chat-product-card')).toBeVisible();
      await expect(page.locator('.chat-composer textarea')).toBeEnabled();

      const headerImage = page.locator('.chat-header-avatar img');
      if (productImageSrc) {
        await expect(headerImage).toHaveAttribute('src', productImageSrc);
        await expectLoadedImage(headerImage);
      }

      customerServiceCtaFound = true;
      console.log('MESSAGES_CUSTOMER_SERVICE_CTA_ACCEPTANCE=passed');
      break;
    }

    if (customerServiceCtaFound) break;
  }

  test.skip(
    !customerServiceCtaFound,
    'No published customer-service product is available for production acceptance.',
  );
});
