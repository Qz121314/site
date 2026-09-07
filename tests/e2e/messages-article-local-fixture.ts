import type { Page } from '@playwright/test';

const PUBLISHED_AT = '2026-09-07T00:00:00.000Z';
const POINTER_VERSION = 'article-pointer-0001';
const SITE_VERSION = 'article-site-00001';
const INDEX_VERSION = 'article-index-0001';
const FAQ_VERSION = 'article-faq-000001';
const MEDIA_ORIGIN = 'https://media.example.test';
const SUPPORT_ORIGIN = 'https://support.example.test';

export const MESSAGE_ARTICLE_IDS = {
  alpha: 'article-alpha',
  beta: 'article-beta',
  gamma: 'article-gamma',
} as const;

const moduleReference = (contentVersion: string) => ({
  contentVersion,
  manifestKey: `test/${contentVersion}`,
  sourceRevision: 'critical-e2e',
  publishedAt: PUBLISHED_AT,
});

const messageArticles = [
  {
    articleId: MESSAGE_ARTICLE_IDS.beta,
    title: 'Beta guide',
    preview: 'A neutral card without background media.',
    backgroundObjectKey: null,
    sortOrder: 20,
  },
  {
    articleId: MESSAGE_ARTICLE_IDS.alpha,
    title: 'Alpha guide',
    preview: 'The first recommended article from bootstrap metadata.',
    backgroundObjectKey: 'messages/alpha.svg',
    sortOrder: 10,
  },
  {
    articleId: MESSAGE_ARTICLE_IDS.gamma,
    title: 'Gamma guide',
    preview: 'A card that remains usable when its background cannot load.',
    backgroundObjectKey: 'messages/missing.svg',
    sortOrder: 30,
  },
  {
    articleId: '',
    title: 'Malformed placement',
    preview: 'This item must be isolated.',
    backgroundObjectKey: null,
    sortOrder: 40,
  },
];

const bootstrap = {
  pointer: {
    schemaVersion: 2,
    contentVersion: POINTER_VERSION,
    publishedAt: PUBLISHED_AT,
    site: moduleReference(SITE_VERSION),
    sectionsIndex: moduleReference(INDEX_VERSION),
    faq: moduleReference(FAQ_VERSION),
    sections: {},
  },
  site: {
    schemaVersion: 2,
    moduleKey: 'site',
    contentVersion: SITE_VERSION,
    publishedAt: PUBLISHED_AT,
    site: {
      name: 'Article Test Site',
      locationLabel: 'Test',
      logoObjectKey: null,
      homeSectionLimit: 5,
      homeLayout: {
        shortcutSectionIds: [],
        recommendationSectionIds: [],
      },
      hero: null,
      navigation: {
        showHot: true,
        showLatest: true,
        showMore: true,
        showFaq: true,
        messageArticles,
      },
      analytics: { ga4MeasurementId: null },
    },
  },
  sectionsIndex: {
    schemaVersion: 2,
    moduleKey: 'sections-index',
    contentVersion: INDEX_VERSION,
    publishedAt: PUBLISHED_AT,
    sections: [],
  },
  home: {
    schemaVersion: 2,
    pointerVersion: POINTER_VERSION,
    publishedAt: PUBLISHED_AT,
    featuredProducts: [],
    latestProducts: [],
  },
  mediaBaseUrl: MEDIA_ORIGIN,
  theme: {
    key: 'marketplace',
    colorScheme: 'light',
    density: 'standard',
    productMediaRatio: '1:1',
    recipe: {
      version: 2,
      fontPack: 'modern',
      buttonStyle: 'refined',
      mediaStyle: 'precise',
      motionStyle: 'restrained',
      navigationStyle: 'quiet',
    },
    installPrompt: {
      enabled: false,
      delaySeconds: 30,
      title: '',
      description: '',
      iosDescription: '',
      installLabel: '',
      dismissLabel: '',
    },
    tokens: {
      brand: '#ff5a1f',
      brandStrong: '#d8430d',
      text: '#17191c',
      muted: '#73777f',
      surface: '#ffffff',
      surfaceSoft: '#f5f6f8',
      line: '#e5e7eb',
      pageBg: '#f5f6f8',
      heroStart: '#ffffff',
      heroEnd: '#f5f6f8',
      heroGlow: '#ffede5',
      shadow: 'rgba(0, 0, 0, 0.08)',
    },
  },
  bottomNavigation: [
    { key: 'home', label: 'Home', enabled: true, icon: { type: 'builtin', value: null } },
    {
      key: 'browse',
      label: 'Browse',
      enabled: true,
      icon: { type: 'builtin', value: null },
    },
    {
      key: 'messages',
      label: 'Messages',
      enabled: true,
      icon: { type: 'builtin', value: null },
    },
    { key: 'faq', label: 'FAQ', enabled: true, icon: { type: 'builtin', value: null } },
  ],
};

const articles = {
  schemaVersion: 2,
  moduleKey: 'faq',
  contentVersion: FAQ_VERSION,
  publishedAt: PUBLISHED_AT,
  articles: [
    {
      id: MESSAGE_ARTICLE_IDS.alpha,
      title: 'Alpha guide',
      body: '# Alpha guide\n\nAlpha article detail.',
      sortOrder: 10,
    },
    {
      id: MESSAGE_ARTICLE_IDS.beta,
      title: 'Beta guide',
      body: '# Beta guide\n\nBeta article detail.',
      sortOrder: 20,
    },
    {
      id: MESSAGE_ARTICLE_IDS.gamma,
      title: 'Gamma guide',
      body: '# Gamma guide\n\nGamma article detail.',
      sortOrder: 30,
    },
  ],
};

type LocalMessagesArticleFixture = {
  articleDetailRequests: () => number;
  supportHttpRequests: () => number;
  supportMutationRequests: () => number;
};

export async function installLocalMessagesArticleFixture(
  page: Page,
  options: { messageArticles?: unknown[] } = {},
): Promise<LocalMessagesArticleFixture> {
  let articleDetailRequestCount = 0;
  let supportHttpRequestCount = 0;
  let supportMutationRequestCount = 0;
  const fixtureBootstrap = structuredClone(bootstrap);
  fixtureBootstrap.site.site.navigation.messageArticles =
    options.messageArticles ?? messageArticles;

  await page.route('**/api/public/storefront/bootstrap', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixtureBootstrap),
    });
  });
  await page.route(`**/public/modules/faq/${FAQ_VERSION}/articles.json`, async (route) => {
    articleDetailRequestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(articles),
    });
  });
  await page.route(`${MEDIA_ORIGIN}/messages/alpha.svg`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#ddd"/></svg>',
    });
  });
  await page.route(`${MEDIA_ORIGIN}/messages/missing.svg`, (route) => route.abort());
  await page.route('**/_media/messages/missing.svg', (route) => route.abort());
  await page.route('**/api/public/storefront/support/connections', async (route) => {
    supportHttpRequestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        connections: [
          {
            id: 'support-test',
            clientApiUrl: `${SUPPORT_ORIGIN}/client`,
            realtimeUrl: `${SUPPORT_ORIGIN.replace('https:', 'wss:')}/realtime`,
            protocolVersion: 'v1',
          },
        ],
      }),
    });
  });
  await page.route(`${SUPPORT_ORIGIN}/client/conversations**`, async (route) => {
    supportHttpRequestCount += 1;
    if (route.request().method() !== 'GET') supportMutationRequestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        conversations: [
          {
            id: 'conversation-1',
            agentName: 'Support',
            agentAvatarUrl: null,
            productId: 'product-1',
            sectionId: 'section-1',
            productTitle: 'Support product',
            productCoverUrl: null,
            lastMessage: 'Existing support message',
            lastMessageAt: PUBLISHED_AT,
            unreadCount: 3,
            status: 'active',
          },
        ],
      }),
    });
  });

  return {
    articleDetailRequests: () => articleDetailRequestCount,
    supportHttpRequests: () => supportHttpRequestCount,
    supportMutationRequests: () => supportMutationRequestCount,
  };
}
