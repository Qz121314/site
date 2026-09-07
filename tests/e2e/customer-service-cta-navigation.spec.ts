import { expect, test } from '@playwright/test';
import { installLocalCustomerServiceCtaFixture } from './customer-service-cta-local-fixture';
import {
  installLocalMessagesArticleFixture,
  MESSAGE_ARTICLE_IDS,
} from './messages-article-local-fixture';
import { findPublishedProductRoute } from './published-storefront-fixtures';

const useLocalFixture = process.env.E2E_LOCAL_SERVER === '1';

test('customer-service CTA opens the chat shell before the Worker handoff resolves', async ({
  page,
  request,
}) => {
  const productHref = useLocalFixture
    ? await installLocalCustomerServiceCtaFixture(page)
    : (await findPublishedProductRoute(request))?.productHref;
  test.skip(!productHref, 'No published product is available for CTA verification.');

  await page.route('**/api/public/storefront/cta/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        available: true,
        label: 'Contact',
        mode: 'customer_service',
        path: '/go/__cta-navigation-test__',
      }),
    });
  });

  let releaseHandoff!: () => void;
  const holdHandoff = new Promise<void>((resolve) => {
    releaseHandoff = resolve;
  });
  let conversionRequestType: string | null = null;
  let conversionAcceptHeader: string | null = null;
  let conversionRequestCount = 0;
  await page.route('**/go/__cta-navigation-test__', async (route) => {
    conversionRequestCount += 1;
    conversionRequestType = route.request().resourceType();
    conversionAcceptHeader = route.request().headers().accept ?? null;
    await holdHandoff;
    await route.abort();
  });

  await page.goto(productHref!);
  const cta = page.locator(
    '.storefront-route-action-host .product-detail-route-action .cta-button',
  );
  await expect(cta).toBeVisible();
  await expect(cta).toContainText('Contact');

  await cta.click();

  await expect(page).toHaveURL(/\/messages\/new\/\?/u);
  await expect(page.locator('.chat-page')).toBeVisible();
  await expect(page.locator('.chat-header')).toBeVisible();
  await expect(page.locator('.chat-product-card')).toBeVisible();
  await expect(page.locator('.chat-composer')).toBeVisible();
  await expect(page.locator('.chat-connection-state .loading-halo')).toBeVisible();
  await expect.poll(() => conversionRequestType).toBe('fetch');
  expect(conversionAcceptHeader).toContain('application/json');
  expect(conversionRequestCount).toBe(1);

  releaseHandoff();
});

test('Messages Article rows mark read only on detail', async ({ page }) => {
  test.skip(
    !useLocalFixture,
    'Messages Article acceptance uses the deterministic local fixture.',
  );
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const fixture = await installLocalMessagesArticleFixture(page);

  await page.goto('/messages/');

  const listFlow = page.locator('[data-messages-list="conversation-flow"]');
  await expect(listFlow).toBeVisible();
  const flowLinks = listFlow.getByRole('link');
  await expect(flowLinks).toHaveCount(4);
  await expect(flowLinks.nth(0)).toContainText('Alpha guide');
  await expect(flowLinks.nth(1)).toContainText('Beta guide');
  await expect(flowLinks.nth(2)).toContainText('Gamma guide');
  await expect(flowLinks.nth(3)).toContainText('Support');
  await expect(flowLinks.nth(0)).toContainText(
    'The first recommended article from bootstrap metadata.',
  );
  await expect(flowLinks.nth(1)).toContainText(
    'A neutral card without background media.',
  );
  await expect(page.getByText('Malformed placement')).toHaveCount(0);
  await expect(page.getByText('Recommended articles', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Conversations', { exact: true })).toHaveCount(0);

  const alphaRow = page.getByRole('link', { name: /Alpha guide/u });
  const betaRow = page.getByRole('link', { name: /Beta guide/u });
  const gammaRow = page.getByRole('link', { name: /Gamma guide/u });
  await expect(alphaRow).toHaveAttribute(
    'href',
    `/articles/${encodeURIComponent(MESSAGE_ARTICLE_IDS.alpha)}/`,
  );
  await expect(alphaRow).toHaveAttribute('data-read-state', 'unread');
  await expect(alphaRow.getByText('New')).toBeVisible();
  await expect(betaRow.getByText('New')).toBeVisible();
  await expect(gammaRow.getByText('New')).toBeVisible();
  await expect(betaRow.locator('img')).toHaveCount(0);
  await expect(alphaRow.locator('img')).toHaveAttribute(
    'src',
    'https://media.example.test/messages/alpha.svg',
  );
  await expect(alphaRow.locator('img')).toBeVisible();
  await expect(gammaRow.locator('img')).toHaveCount(0);

  const nativeListGeometry = await page.evaluate(() => {
    const list = document.querySelector('[data-messages-list="conversation-flow"]');
    const article = document.querySelector('.messages-article-row');
    const conversation = document.querySelector('.conversation-row');
    const sidebar = document.querySelector('.messages-sidebar');
    if (!list || !article || !conversation || !sidebar) return null;

    const listRect = list.getBoundingClientRect();
    const articleRect = article.getBoundingClientRect();
    const conversationRect = conversation.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    const rootStyles = getComputedStyle(document.documentElement);
    const appGutter = Number.parseFloat(rootStyles.getPropertyValue('--app-gutter'));
    const tolerance = 1;

    return {
      rowsShareEdges:
        Math.abs(articleRect.left - conversationRect.left) < tolerance &&
        Math.abs(articleRect.right - conversationRect.right) < tolerance,
      listPreservesNativeFullBleed:
        Number.isFinite(appGutter) &&
        Math.abs(listRect.left - (sidebarRect.left - appGutter)) < tolerance &&
        Math.abs(listRect.right - (sidebarRect.right + appGutter)) < tolerance,
    };
  });
  expect(nativeListGeometry).toEqual({
    rowsShareEdges: true,
    listPreservesNativeFullBleed: true,
  });

  expect(
    await page.evaluate(() => localStorage.getItem('site:messages:read-articles')),
  ).toBe(null);
  expect(fixture.articleDetailRequests()).toBe(0);
  expect(fixture.supportMutationRequests()).toBe(0);
  const supportRequestsBeforeArticle = fixture.supportHttpRequests();

  const messagesNav = page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('link', { name: 'Messages' });
  await expect(messagesNav.getByText('6')).toBeVisible();

  await alphaRow.click();
  await expect(page).toHaveURL(`/articles/${MESSAGE_ARTICLE_IDS.alpha}/`);
  await expect(
    page.getByRole('heading', { name: 'Alpha guide', level: 1 }),
  ).toBeVisible();
  expect(fixture.articleDetailRequests()).toBe(1);

  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page).toHaveURL('/messages/');
  const returnedAlphaRow = page.getByRole('link', { name: /Alpha guide/u });
  await expect(returnedAlphaRow).toHaveAttribute('data-read-state', 'read');
  await expect(returnedAlphaRow.getByText('New')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: /Beta guide/u }).getByText('New'),
  ).toBeVisible();
  await expect(messagesNav.getByText('5')).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('site:messages:read-articles')),
  ).toBe(JSON.stringify([MESSAGE_ARTICLE_IDS.alpha]));
  expect(fixture.supportHttpRequests()).toBe(supportRequestsBeforeArticle);
  expect(fixture.supportMutationRequests()).toBe(0);
  expect(pageErrors).toEqual([]);
});

test('zero Articles leaves the support list unchanged', async ({ page }) => {
  test.skip(
    !useLocalFixture,
    'Messages Article acceptance uses the deterministic local fixture.',
  );
  await installLocalMessagesArticleFixture(page, { messageArticles: [] });

  await page.goto('/messages/');

  const listFlow = page.locator('[data-messages-list="conversation-flow"]');
  await expect(listFlow).toBeVisible();
  const flowLinks = listFlow.getByRole('link');
  await expect(flowLinks).toHaveCount(1);
  await expect(flowLinks.nth(0)).toContainText('Support');
  await expect(page.getByText('Recommended articles', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Conversations', { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem('site:messages:read-articles')),
  ).toBe(null);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
});
