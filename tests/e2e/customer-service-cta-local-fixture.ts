import type { Page } from '@playwright/test';

const PUBLISHED_AT = '2026-08-22T00:00:00.000Z';
const POINTER_VERSION = 'cta-pointer-0001';
const SITE_VERSION = 'cta-site-000001';
const INDEX_VERSION = 'cta-index-00001';
const FAQ_VERSION = 'cta-faq-0000001';
const SECTION_VERSION = 'cta-section-001';
const SECTION_ID = 'cta-section';
const PRODUCT_ID = 'cta-product';

const moduleReference = (contentVersion: string) => ({
  contentVersion,
  manifestKey: `test/${contentVersion}`,
  sourceRevision: 'critical-e2e',
  publishedAt: PUBLISHED_AT,
});

const productSummary = {
  id: PRODUCT_ID,
  slug: PRODUCT_ID,
  sectionId: SECTION_ID,
  title: 'CTA Test Product',
  serviceMode: 'online',
  address: null,
  category: { id: null, name: null },
  tags: [],
  coverObjectKey: null,
  isFeatured: true,
  featuredOrder: 0,
  publishedAt: PUBLISHED_AT,
  sortOrder: 0,
};

const bootstrap = {
  pointer: {
    schemaVersion: 2,
    contentVersion: POINTER_VERSION,
    publishedAt: PUBLISHED_AT,
    site: moduleReference(SITE_VERSION),
    sectionsIndex: moduleReference(INDEX_VERSION),
    faq: moduleReference(FAQ_VERSION),
    sections: {
      [SECTION_ID]: moduleReference(SECTION_VERSION),
    },
  },
  site: {
    schemaVersion: 2,
    moduleKey: 'site',
    contentVersion: SITE_VERSION,
    publishedAt: PUBLISHED_AT,
    site: {
      name: 'CTA Test Site',
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
      },
      analytics: { ga4MeasurementId: null },
    },
  },
  sectionsIndex: {
    schemaVersion: 2,
    moduleKey: 'sections-index',
    contentVersion: INDEX_VERSION,
    publishedAt: PUBLISHED_AT,
    sections: [
      {
        id: SECTION_ID,
        slug: SECTION_ID,
        name: 'CTA Test Section',
        description: null,
        browseBackgroundObjectKey: null,
        icon: { type: 'icon', objectKey: null, value: null },
        sortOrder: 0,
      },
    ],
  },
  home: {
    schemaVersion: 2,
    pointerVersion: POINTER_VERSION,
    publishedAt: PUBLISHED_AT,
    featuredProducts: [productSummary],
    latestProducts: [productSummary],
  },
  mediaBaseUrl: null,
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

const product = {
  schemaVersion: 2,
  moduleKey: `section:${SECTION_ID}`,
  contentVersion: SECTION_VERSION,
  publishedAt: PUBLISHED_AT,
  product: {
    ...productSummary,
    body: '',
    media: [],
  },
};

export async function installLocalCustomerServiceCtaFixture(page: Page): Promise<string> {
  await page.route('**/api/public/storefront/bootstrap', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(bootstrap),
    });
  });
  await page.route(
    `**/public/modules/sections/${SECTION_ID}/${SECTION_VERSION}/products/${PRODUCT_ID}.json`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(product),
      });
    },
  );
  await page.route('**/api/public/storefront/support/connections', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ connections: [] }),
    });
  });

  return `/sections/${SECTION_ID}/products/${PRODUCT_ID}/`;
}
