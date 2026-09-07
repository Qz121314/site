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

test('Messages Articles stay title-only and mark read only on the reading page', async ({
  page,
}) => {
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
  await expect(
    page.getByText('The first recommended article from bootstrap metadata.'),
  ).toHaveCount(0);
  await expect(page.getByText('A neutral card without background media.')).toHaveCount(0);
  await expect(page.getByText('Malformed placement')).toHaveCount(0);
  await expect(page.getByText('Recommended articles', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Conversations', { exact: true })).toHaveCount(0);
  await expect(page.getByText('New', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Article', { exact: true })).toHaveCount(0);

  const alphaRow = page.getByRole('link', { name: /Unread article.*Alpha guide/u });
  const betaRow = page.getByRole('link', { name: /Unread article.*Beta guide/u });
  const gammaRow = page.getByRole('link', { name: /Unread article.*Gamma guide/u });
  await expect(alphaRow).toHaveAttribute(
    'href',
    `/articles/${encodeURIComponent(MESSAGE_ARTICLE_IDS.alpha)}/`,
  );
  await expect(alphaRow).toHaveAttribute('data-read-state', 'unread');
  await expect(alphaRow.locator('[data-unread-indicator]')).toHaveCount(1);
  await expect(betaRow.locator('[data-unread-indicator]')).toHaveCount(1);
  await expect(gammaRow.locator('[data-unread-indicator]')).toHaveCount(1);
  await expect(betaRow.locator('img')).toHaveCount(0);
  await expect(alphaRow.locator('img')).toHaveAttribute(
    'src',
    'https://media.example.test/messages/alpha.svg',
  );
  await expect(alphaRow.locator('img')).toBeVisible();
  await expect(gammaRow.locator('img')).toHaveCount(0);

  const rowPresentation = await page.evaluate(() => {
    const alphaTitle = document.querySelector<HTMLElement>(
      '[data-article-id="article-alpha"] h3',
    );
    const betaTitle = document.querySelector<HTMLElement>(
      '[data-article-id="article-beta"] h3',
    );
    const gammaTitle = document.querySelector<HTMLElement>(
      '[data-article-id="article-gamma"] h3',
    );
    if (!alphaTitle || !betaTitle || !gammaTitle) return null;

    const alphaColor = getComputedStyle(alphaTitle).color;
    const betaColor = getComputedStyle(betaTitle).color;
    const gammaColor = getComputedStyle(gammaTitle).color;
    const colorChannels = alphaColor.match(/[\d.]+/gu)?.map(Number) ?? [];
    const lineHeight = Number.parseFloat(getComputedStyle(alphaTitle).lineHeight);
    const titleHeight = alphaTitle.getBoundingClientRect().height;
    const mediaTitleIsLight =
      colorChannels.length >= 3 &&
      colorChannels[0] + colorChannels[1] + colorChannels[2] > 650;
    const titleFitsTwoLines =
      Number.isFinite(lineHeight) && titleHeight <= lineHeight * 2.1;

    return {
      mediaTitleIsLight,
      mediaTitleDiffersFromNeutral: alphaColor !== betaColor,
      failedMediaMatchesNeutral: gammaColor === betaColor,
      titleFitsTwoLines,
    };
  });
  expect(rowPresentation).toEqual({
    mediaTitleIsLight: true,
    mediaTitleDiffersFromNeutral: true,
    failedMediaMatchesNeutral: true,
    titleFitsTwoLines: true,
  });

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
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    };
  });
  expect(nativeListGeometry).toEqual({
    rowsShareEdges: true,
    listPreservesNativeFullBleed: true,
    noHorizontalOverflow: true,
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
  const articleTitle = page.getByRole('heading', { name: /Alpha guide/u, level: 1 });
  await expect(articleTitle).toBeVisible();
  await expect(page.getByText('Article', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Reading section', level: 2 }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Details', level: 3 })).toBeVisible();
  await expect(page.getByText('First unordered point')).toBeVisible();
  await expect(page.getByText('First ordered step')).toBeVisible();
  await expect(
    page.getByText(
      'A concise quoted note that should remain visually distinct from the body copy.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'a reference' })).toHaveAttribute(
    'href',
    'https://example.com/reference',
  );
  await expect(page.getByText('inline code', { exact: true })).toBeVisible();
  await expect(page.locator('article pre code')).toContainText('article-reading-code');
  await expect(page.getByRole('img', { name: 'Reading diagram' })).toBeVisible();
  await expect(page.locator('article hr')).toHaveCount(1);
  expect(fixture.articleDetailRequests()).toBe(1);

  const readingLayout = await page.evaluate(() => {
    const nav = document.querySelector<HTMLElement>('.article-reading-navigation');
    const title = document.querySelector<HTMLElement>('#article-title');
    const body = document.querySelector<HTMLElement>('.article-reading-body');
    const image = document.querySelector<HTMLImageElement>(
      '.article-reading-body img[alt="Reading diagram"]',
    );
    const codeBlock = document.querySelector<HTMLElement>('.article-reading-body pre');
    if (!nav || !title || !body || !image || !codeBlock) return null;

    const titleRect = title.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const stickyHeader = getComputedStyle(nav).position === 'sticky';
    const titleFitsViewport =
      titleRect.left >= -1 && titleRect.right <= window.innerWidth + 1;

    return {
      stickyHeader,
      titleFitsViewport,
      imageFitsReadingWidth: imageRect.width <= bodyRect.width + 1,
      codeContainedByReadingWidth: codeBlock.clientWidth <= body.clientWidth + 1,
      codeCanScrollInternally: codeBlock.scrollWidth >= codeBlock.clientWidth,
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    };
  });
  expect(readingLayout).toEqual({
    stickyHeader: true,
    titleFitsViewport: true,
    imageFitsReadingWidth: true,
    codeContainedByReadingWidth: true,
    codeCanScrollInternally: true,
    noHorizontalOverflow: true,
  });
  expect(
    await page.evaluate(() => localStorage.getItem('site:messages:read-articles')),
  ).toBe(JSON.stringify([MESSAGE_ARTICLE_IDS.alpha]));

  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page).toHaveURL('/messages/');
  const readAlphaRow = page.getByRole('link', { name: /Read article.*Alpha guide/u });
  const betaUnreadIndicator = page
    .getByRole('link', { name: /Unread article.*Beta guide/u })
    .locator('[data-unread-indicator]');
  await expect(readAlphaRow).toHaveAttribute('data-read-state', 'read');
  await expect(readAlphaRow.locator('[data-unread-indicator]')).toHaveCount(0);
  await expect(betaUnreadIndicator).toHaveCount(1);
  await expect(messagesNav.getByText('5')).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('site:messages:read-articles')),
  ).toBe(JSON.stringify([MESSAGE_ARTICLE_IDS.alpha]));
  expect(fixture.supportHttpRequests()).toBe(supportRequestsBeforeArticle);
  expect(fixture.supportMutationRequests()).toBe(0);
  expect(pageErrors).toEqual([]);
});

test('desktop viewport keeps Messages compact and Article reading width bounded', async ({
  page,
}) => {
  test.skip(
    !useLocalFixture,
    'Messages Article acceptance uses the deterministic local fixture.',
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await installLocalMessagesArticleFixture(page);

  await page.goto('/messages/');
  const alphaRow = page.getByRole('link', { name: /Unread article.*Alpha guide/u });
  await expect(alphaRow).toBeVisible();
  await expect(page.locator('.messages-detail-placeholder')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);

  await alphaRow.click();
  await expect(page).toHaveURL(`/articles/${MESSAGE_ARTICLE_IDS.alpha}/`);
  await expect(
    page.getByRole('heading', { name: /Alpha guide/u, level: 1 }),
  ).toBeVisible();

  const desktopReading = await page.evaluate(() => {
    const article = document.querySelector<HTMLElement>('.article-reading-page');
    if (!article) return null;
    const rect = article.getBoundingClientRect();
    const horizontallyCentered =
      Math.abs(rect.left - (window.innerWidth - rect.right)) < 2;

    return {
      boundedReadingWidth: rect.width <= 760,
      horizontallyCentered,
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    };
  });
  expect(desktopReading).toEqual({
    boundedReadingWidth: true,
    horizontallyCentered: true,
    noHorizontalOverflow: true,
  });
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
