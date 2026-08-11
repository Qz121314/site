import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PublicContentError,
  loadFaqSnapshot,
  loadProductSnapshot,
  loadSectionSnapshot,
  loadStorefrontBootstrap,
  normalizeContentOrigin,
  publicContentUrl,
  resolveMediaBaseUrl,
} from '../src/content.ts';

const LEGACY_VERSION = '20260807074900-abcdef123456-deadbeef';
const POINTER_VERSION = '20260807090000-pointer-feedbeef';
const SITE_VERSION = '20260807085000-site12345678-acde1234';
const INDEX_VERSION = '20260807085100-index1234567-acde1235';
const FAQ_VERSION = '20260807085200-faq123456789-acde1236';
const SECTION_A_VERSION = '20260807085300-sectiona12345-acde1237';
const SECTION_B_VERSION = '20260807085400-sectionb12345-acde1238';

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function reference(contentVersion, modulePath) {
  return {
    contentVersion,
    manifestKey: `${modulePath}/${contentVersion}/manifest.json`,
    sourceRevision: `source-${contentVersion}`,
    publishedAt: '2026-08-07T08:55:00.000Z',
  };
}

function modularPointer() {
  return {
    schemaVersion: 2,
    contentVersion: POINTER_VERSION,
    publishedAt: '2026-08-07T09:00:00.000Z',
    site: reference(SITE_VERSION, 'public/modules/site'),
    sectionsIndex: reference(INDEX_VERSION, 'public/modules/sections-index'),
    faq: reference(FAQ_VERSION, 'public/modules/faq'),
    sections: {
      'section-a': reference(SECTION_A_VERSION, 'public/modules/sections/section-a'),
      'section-b': reference(SECTION_B_VERSION, 'public/modules/sections/section-b'),
    },
  };
}

function siteModule() {
  return {
    schemaVersion: 2,
    moduleKey: 'site',
    contentVersion: SITE_VERSION,
    publishedAt: '2026-08-07T08:50:00.000Z',
    site: {
      name: 'Directory',
      locationLabel: 'City',
      mediaBaseUrl: 'https://media.example.com',
      logoObjectKey: 'branding/logo.webp',
      homeSectionLimit: 8,
      navigation: {
        showHot: true,
        showLatest: true,
        showMore: true,
        showMessages: false,
        showFaq: true,
      },
      analytics: { ga4MeasurementId: null, facebookPixelId: null },
      affiliate: { enabled: false, platform: null },
    },
  };
}

function sectionsIndexModule() {
  return {
    schemaVersion: 2,
    moduleKey: 'sections-index',
    contentVersion: INDEX_VERSION,
    publishedAt: '2026-08-07T08:51:00.000Z',
    sections: [
      {
        id: 'section-a',
        slug: 'alpha',
        name: 'Alpha',
        description: 'Alpha description',
        browseBackgroundObjectKey: 'sections/alpha-browse.webp',
        icon: { type: 'image', objectKey: 'sections/alpha.webp', value: null },
        sortOrder: 0,
      },
      {
        id: 'section-b',
        slug: 'beta',
        name: 'Beta',
        icon: { type: 'icon', objectKey: null, value: 'B' },
        sortOrder: 10,
      },
    ],
  };
}

function sectionModule(sectionId, version, productId, featuredOrder) {
  return {
    schemaVersion: 2,
    moduleKey: `section:${sectionId}`,
    contentVersion: version,
    publishedAt: '2026-08-07T08:53:00.000Z',
    sectionId,
    categories: [
      { id: `category-${sectionId}`, sectionId, name: 'Primary', sortOrder: 0 },
    ],
    tags: [{ id: `tag-${sectionId}`, sectionId, name: 'Verified', sortOrder: 0 }],
    products: [
      {
        id: productId,
        slug: `${productId}-slug`,
        sectionId,
        title: `Product ${productId}`,
        serviceMode: 'online',
        address: null,
        category: { id: `category-${sectionId}`, name: 'Primary' },
        tags: [{ id: `tag-${sectionId}`, name: 'Verified', sortOrder: 0 }],
        coverObjectKey: `products/${productId}/cover.webp`,
        isFeatured: true,
        featuredOrder,
        publishedAt: `2026-08-07T08:${featuredOrder === 1 ? '54' : '55'}:00.000Z`,
        sortOrder: 0,
      },
    ],
  };
}

function derivedHomeSnapshot() {
  const productA = sectionModule('section-a', SECTION_A_VERSION, 'product-a', 2)
    .products[0];
  const productB = sectionModule('section-b', SECTION_B_VERSION, 'product-b', 1)
    .products[0];
  return {
    schemaVersion: 2,
    pointerVersion: POINTER_VERSION,
    publishedAt: '2026-08-07T09:00:00.000Z',
    featuredProducts: [productB, productA],
    latestProducts: [productA, productB],
  };
}

function installModularFetch(requests = [], { homeAvailable = true } = {}) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, cache: init?.cache, credentials: init?.credentials });
    if (url === '/api/public/storefront/media-base-url') {
      return jsonResponse({ mediaBaseUrl: 'https://media.example.com' });
    }
    if (url.endsWith('/public/current.json')) return jsonResponse(modularPointer());
    if (url.endsWith(`/public/modules/site/${SITE_VERSION}/site.json`))
      return jsonResponse(siteModule());
    if (url.endsWith(`/public/modules/sections-index/${INDEX_VERSION}/sections.json`)) {
      return jsonResponse(sectionsIndexModule());
    }
    if (url.endsWith(`/public/home/${POINTER_VERSION}/home.json`)) {
      return homeAvailable ? jsonResponse(derivedHomeSnapshot()) : jsonResponse({}, 404);
    }
    if (
      url.endsWith(`/public/modules/sections/section-a/${SECTION_A_VERSION}/section.json`)
    ) {
      return jsonResponse(sectionModule('section-a', SECTION_A_VERSION, 'product-a', 2));
    }
    if (
      url.endsWith(`/public/modules/sections/section-b/${SECTION_B_VERSION}/section.json`)
    ) {
      return jsonResponse(sectionModule('section-b', SECTION_B_VERSION, 'product-b', 1));
    }
    if (
      url.endsWith(
        `/public/modules/sections/section-a/${SECTION_A_VERSION}/products/product-a.json`,
      )
    ) {
      return jsonResponse({
        schemaVersion: 2,
        moduleKey: 'section:section-a',
        contentVersion: SECTION_A_VERSION,
        publishedAt: '2026-08-07T08:53:00.000Z',
        product: {
          ...sectionModule('section-a', SECTION_A_VERSION, 'product-a', 2).products[0],
          body: '**Details**',
          media: [
            {
              id: 'media-a',
              objectKey: 'products/product-a/gallery-1.webp',
              width: 800,
              height: 800,
              altText: 'Gallery',
              sortOrder: 0,
            },
          ],
        },
      });
    }
    if (url.endsWith(`/public/modules/faq/${FAQ_VERSION}/faq.json`)) {
      return jsonResponse({
        schemaVersion: 2,
        moduleKey: 'faq',
        contentVersion: FAQ_VERSION,
        publishedAt: '2026-08-07T08:52:00.000Z',
        faqs: [{ id: 'faq-1', title: 'Question', body: 'Answer', sortOrder: 0 }],
      });
    }
    return jsonResponse({}, 404);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test('content origin normalization accepts public HTTP(S) URLs and removes the trailing slash', () => {
  assert.equal(
    normalizeContentOrigin(' https://cdn.example.com/ '),
    'https://cdn.example.com',
  );
  assert.equal(normalizeContentOrigin('http://localhost:8787/'), 'http://localhost:8787');
  assert.equal(normalizeContentOrigin('javascript:alert(1)'), null);
  assert.equal(normalizeContentOrigin('https://user:pass@example.com/'), null);
  assert.equal(normalizeContentOrigin('https://cdn.example.com/?token=secret'), null);
  assert.equal(normalizeContentOrigin(''), null);
});

test('public content URL builder normalizes an explicit origin', () => {
  assert.equal(
    publicContentUrl('https://cdn.example.com/', '/public/current.json'),
    'https://cdn.example.com/public/current.json',
  );
});

test('legacy schema-v1 bootstrap remains readable and normalizes missing tags/featured order', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/public/current.json')) {
      return jsonResponse({
        schemaVersion: 1,
        contentVersion: LEGACY_VERSION,
        manifestKey: `public/versions/${LEGACY_VERSION}/manifest.json`,
        sourceRevision: 'source-revision',
        publishedAt: '2026-08-07T07:49:00.000Z',
      });
    }
    if (url.endsWith('/site.json')) {
      return jsonResponse({
        schemaVersion: 1,
        contentVersion: LEGACY_VERSION,
        publishedAt: '2026-08-07T07:49:00.000Z',
        site: {
          name: 'Directory',
          locationLabel: 'City',
          mediaBaseUrl: 'https://cdn.example.com',
          logoUrl: null,
          navigation: {
            showHot: true,
            showLatest: true,
            showMore: true,
            showMessages: false,
            showFaq: true,
          },
          analytics: { ga4MeasurementId: null, facebookPixelId: null },
          affiliate: { enabled: false, platform: null },
        },
      });
    }
    if (url.endsWith('/home.json')) {
      return jsonResponse({
        schemaVersion: 1,
        contentVersion: LEGACY_VERSION,
        publishedAt: '2026-08-07T07:49:00.000Z',
        sections: [],
        allSections: [],
        featuredProducts: [
          {
            id: 'legacy-product',
            slug: 'legacy-product',
            sectionId: 'section-1',
            sectionSlug: 'main',
            sectionName: 'Main',
            title: 'Legacy product',
            serviceMode: 'online',
            address: null,
            category: { id: 'category-1', name: 'Primary' },
            coverUrl: null,
            isFeatured: true,
            publishedAt: '2026-08-07T07:40:00.000Z',
            sortOrder: 0,
          },
        ],
        latestProducts: [],
      });
    }
    return jsonResponse({}, 404);
  };

  try {
    const result = await loadStorefrontBootstrap('https://cdn.example.com');
    assert.equal(result.pointer.schemaVersion, 1);
    assert.deepEqual(result.home.featuredProducts[0].tags, []);
    assert.equal(result.home.featuredProducts[0].featuredOrder, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Storefront reads JSON from its Worker and media from runtime configuration', async () => {
  const requests = [];
  const restore = installModularFetch(requests);
  const previousWindow = globalThis.window;
  globalThis.window = { location: { origin: 'https://app.example.com' } };
  try {
    const bootstrap = await loadStorefrontBootstrap();
    assert.equal(bootstrap.origin, 'https://app.example.com');
    assert.equal(requests[0].url, 'https://app.example.com/public/current.json');
    assert.ok(
      requests
        .filter(
          (request) => request.url.includes('/public/') && !request.url.includes('/api/'),
        )
        .every((request) => request.url.startsWith('https://app.example.com/')),
    );
    assert.equal(bootstrap.site.site.mediaBaseUrl, 'https://media.example.com');
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    restore();
  }
});

test('changing the admin R2 domain is picked up without rebuilding the Storefront', async () => {
  const originalFetch = globalThis.fetch;
  let configuredOrigin = 'https://media-old.example.com';
  globalThis.fetch = async (input) => {
    assert.equal(String(input), '/api/public/storefront/media-base-url');
    return jsonResponse({ mediaBaseUrl: configuredOrigin });
  };

  try {
    assert.equal(await resolveMediaBaseUrl(), 'https://media-old.example.com');
    configuredOrigin = 'https://media-new.example.com';
    assert.equal(await resolveMediaBaseUrl(), 'https://media-new.example.com');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('schema-v2 bootstrap reads the compact home summary without preloading section snapshots', async () => {
  const requests = [];
  const restore = installModularFetch(requests);
  try {
    const bootstrap = await loadStorefrontBootstrap('https://content.example.com');
    assert.equal(bootstrap.pointer.schemaVersion, 2);
    assert.deepEqual(Object.keys(bootstrap.sectionSnapshots), []);
    assert.deepEqual(
      bootstrap.home.featuredProducts.map((product) => product.id),
      ['product-b', 'product-a'],
    );
    assert.deepEqual(
      bootstrap.home.latestProducts.map((product) => product.id),
      ['product-a', 'product-b'],
    );
    assert.equal(
      bootstrap.home.allSections[0].icon.value,
      'https://media.example.com/sections/alpha.webp',
    );
    assert.equal(bootstrap.home.allSections[0].description, 'Alpha description');
    assert.equal(
      bootstrap.home.allSections[0].browseBackgroundUrl,
      'https://media.example.com/sections/alpha-browse.webp',
    );
    assert.equal(bootstrap.home.allSections[1].description, null);
    assert.equal(bootstrap.home.allSections[1].browseBackgroundUrl, null);
    assert.equal(
      bootstrap.home.featuredProducts[0].coverUrl,
      'https://media.example.com/products/product-b/cover.webp',
    );
    assert.ok(
      requests.some((request) =>
        request.url.endsWith(`/public/home/${POINTER_VERSION}/home.json`),
      ),
    );
    assert.equal(
      requests.filter((request) => request.url.endsWith('/section.json')).length,
      0,
    );
  } finally {
    restore();
  }
});

test('schema-v2 bootstrap falls back to eager section composition when a derived home snapshot does not exist yet', async () => {
  const requests = [];
  const restore = installModularFetch(requests, { homeAvailable: false });
  try {
    const bootstrap = await loadStorefrontBootstrap('https://content.example.com');
    assert.equal(
      bootstrap.sectionSnapshots['section-a'].contentVersion,
      SECTION_A_VERSION,
    );
    assert.equal(
      bootstrap.sectionSnapshots['section-b'].contentVersion,
      SECTION_B_VERSION,
    );
    assert.deepEqual(
      bootstrap.home.featuredProducts.map((product) => product.id),
      ['product-b', 'product-a'],
    );
    assert.equal(
      requests.filter((request) => request.url.endsWith('/section.json')).length,
      2,
    );
  } finally {
    restore();
  }
});

test('section, product and FAQ reads follow their own module versions and cache sections on demand', async () => {
  const requests = [];
  const restore = installModularFetch(requests);
  try {
    const bootstrap = await loadStorefrontBootstrap('https://content.example.com');
    assert.equal(
      requests.filter((request) => request.url.endsWith('/section.json')).length,
      0,
    );

    const section = await loadSectionSnapshot(bootstrap, 'section-a');
    assert.equal(section.contentVersion, SECTION_A_VERSION);
    assert.equal(
      section.products[0].coverUrl,
      'https://media.example.com/products/product-a/cover.webp',
    );
    assert.equal(
      requests.filter(
        (request) =>
          request.url.includes(SECTION_A_VERSION) &&
          request.url.endsWith('/section.json'),
      ).length,
      1,
    );

    const sectionBySlug = await loadSectionSnapshot(bootstrap, 'alpha');
    assert.equal(sectionBySlug.section.id, 'section-a');
    assert.equal(
      requests.filter(
        (request) =>
          request.url.includes(SECTION_A_VERSION) &&
          request.url.endsWith('/section.json'),
      ).length,
      1,
    );

    const product = await loadProductSnapshot(
      bootstrap,
      'product-a-slug',
      undefined,
      'alpha',
    );
    assert.equal(product.contentVersion, SECTION_A_VERSION);
    assert.equal(product.product.id, 'product-a');
    assert.equal(
      product.product.media[0].url,
      'https://media.example.com/products/product-a/gallery-1.webp',
    );
    assert.equal('cta' in product.product, false);

    const globallyUniqueSlug = await loadProductSnapshot(bootstrap, 'product-a-slug');
    assert.equal(globallyUniqueSlug.product.id, 'product-a');
    assert.equal(
      requests.filter(
        (request) =>
          request.url.includes(SECTION_B_VERSION) &&
          request.url.endsWith('/section.json'),
      ).length,
      1,
    );

    const faq = await loadFaqSnapshot(bootstrap);
    assert.equal(faq.contentVersion, FAQ_VERSION);
    assert.equal(faq.faqs[0].title, 'Question');
  } finally {
    restore();
  }
});

test('schema-v2 bootstrap rejects a module whose contentVersion does not match the pointer', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/public/current.json')) return jsonResponse(modularPointer());
    if (url.endsWith(`/public/modules/site/${SITE_VERSION}/site.json`)) {
      return jsonResponse({
        ...siteModule(),
        contentVersion: '20260807090000-wrongversion-acde9999',
      });
    }
    if (url.endsWith(`/public/modules/sections-index/${INDEX_VERSION}/sections.json`)) {
      return jsonResponse(sectionsIndexModule());
    }
    return jsonResponse({}, 404);
  };

  try {
    await assert.rejects(
      loadStorefrontBootstrap('https://content.example.com'),
      (error) =>
        error instanceof PublicContentError && error.code === 'SNAPSHOT_VERSION_MISMATCH',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
