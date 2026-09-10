import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadStorefrontBootstrap } from '../src/content.ts';
import {
  createPublicContentFetch,
  STOREFRONT_DIRECT_BOOTSTRAP_SCHEMA_CURRENT,
  STOREFRONT_DIRECT_BOOTSTRAP_SCHEMA_MIN_READABLE,
} from '../src/public-content-transport.ts';

const APP_ORIGIN = 'https://app.example.com';
const CDN_ORIGIN = 'https://cdn.example.com';
const POINTER_VERSION = 'content-20260908-abcdef';
const WORKER_BOOTSTRAP_URL = `${APP_ORIGIN}/api/public/storefront/bootstrap`;

function jsonResponse(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

function moduleReference(name) {
  return {
    contentVersion: `${name}-20260908-abcdef`,
    manifestKey: `public/modules/${name}/${name}-20260908-abcdef/manifest.json`,
    sourceRevision: 'source-revision',
    publishedAt: '2026-09-08T00:00:00.000Z',
  };
}

function pointerFixture() {
  return {
    schemaVersion: 2,
    contentVersion: POINTER_VERSION,
    publishedAt: '2026-09-08T00:00:00.000Z',
    site: moduleReference('site'),
    sectionsIndex: moduleReference('sections-index'),
    faq: moduleReference('faq'),
    sections: {},
  };
}

function themeFixture() {
  return {
    key: 'default',
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
      enabled: true,
      delaySeconds: 30,
      title: 'Install',
      description: 'Install this app.',
      iosDescription: 'Add to Home Screen.',
      installLabel: 'Install',
      dismissLabel: 'Later',
    },
    tokens: {
      brand: '#111111',
      brandStrong: '#000000',
      text: '#111111',
      muted: '#666666',
      surface: '#ffffff',
      surfaceSoft: '#f5f5f5',
      line: '#dddddd',
      pageBg: '#ffffff',
      heroStart: '#ffffff',
      heroEnd: '#f5f5f5',
      heroGlow: '#ffffff',
      shadow: 'rgba(0,0,0,0.1)',
    },
  };
}

function bottomNavigationFixture() {
  return [
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
  ];
}

function siteEnvelopeFixture(pointer = pointerFixture()) {
  return {
    schemaVersion: 2,
    moduleKey: 'site',
    contentVersion: pointer.site.contentVersion,
    publishedAt: pointer.site.publishedAt,
    site: {
      name: 'Example Site',
      locationLabel: 'Example Location',
      logoObjectKey: null,
      homeSectionLimit: 5,
      navigation: {
        showHot: true,
        showLatest: true,
        showMore: true,
        showFaq: true,
        messageArticles: [],
      },
      analytics: { ga4MeasurementId: null },
      runtime: {
        mediaBaseUrl: CDN_ORIGIN,
        theme: themeFixture(),
        bottomNavigation: bottomNavigationFixture(),
      },
    },
  };
}

function sectionsEnvelopeFixture(pointer = pointerFixture()) {
  return {
    schemaVersion: 2,
    moduleKey: 'sections-index',
    contentVersion: pointer.sectionsIndex.contentVersion,
    publishedAt: pointer.sectionsIndex.publishedAt,
    sections: [],
  };
}

function homeEnvelopeFixture() {
  return {
    schemaVersion: 2,
    pointerVersion: POINTER_VERSION,
    publishedAt: '2026-09-08T00:00:00.000Z',
    featuredProducts: [],
    latestProducts: [],
  };
}

function publishedBootstrapFixture(pointer = pointerFixture()) {
  return {
    schemaVersion: STOREFRONT_DIRECT_BOOTSTRAP_SCHEMA_CURRENT,
    protocol: {
      schemaVersion: STOREFRONT_DIRECT_BOOTSTRAP_SCHEMA_CURRENT,
      minReadableSchemaVersion: STOREFRONT_DIRECT_BOOTSTRAP_SCHEMA_MIN_READABLE,
      capabilities: [
        'published-runtime-config',
        'lightweight-message-articles',
        'sections-index',
        'home-index',
      ],
    },
    pointerVersion: pointer.contentVersion,
    site: siteEnvelopeFixture(pointer),
    sectionsIndex: sectionsEnvelopeFixture(pointer),
    home: homeEnvelopeFixture(),
  };
}

function workerBootstrapFixture(pointer = pointerFixture()) {
  const published = publishedBootstrapFixture(pointer);
  return {
    pointer,
    site: published.site,
    sectionsIndex: published.sectionsIndex,
    home: published.home,
    mediaBaseUrl: CDN_ORIGIN,
    theme: themeFixture(),
    bottomNavigation: bottomNavigationFixture(),
  };
}

async function withMockedFetch(mockFetch, run) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = previousFetch;
  }
}

test('browser direct bootstrap schema constants stay synchronized with the published protocol', () => {
  const protocol = JSON.parse(
    readFileSync(
      new URL(
        '../../worker/src/publishing/storefront-bootstrap-protocol.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  assert.equal(STOREFRONT_DIRECT_BOOTSTRAP_SCHEMA_CURRENT, protocol.currentSchemaVersion);
  assert.equal(
    STOREFRONT_DIRECT_BOOTSTRAP_SCHEMA_MIN_READABLE,
    protocol.minReadableSchemaVersion,
  );
});

test('healthy storefront bootstrap reads current and versioned bootstrap directly from CDN', async () => {
  const pointer = pointerFixture();
  const calls = [];
  const originalFetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url === `${CDN_ORIGIN}/public/current.json`) return jsonResponse(pointer);
    if (url === `${CDN_ORIGIN}/public/bootstrap/${POINTER_VERSION}/bootstrap.json`) {
      return jsonResponse(publishedBootstrapFixture(pointer));
    }
    throw new Error(`Unexpected Worker request: ${url}`);
  };
  const wrapped = createPublicContentFetch(
    originalFetch,
    APP_ORIGIN,
    Date.now,
    CDN_ORIGIN,
  );

  const bootstrap = await withMockedFetch(wrapped, () =>
    loadStorefrontBootstrap(APP_ORIGIN),
  );

  assert.equal(bootstrap.site.site.name, 'Example Site');
  assert.deepEqual(calls, [
    `${CDN_ORIGIN}/public/current.json`,
    `${CDN_ORIGIN}/public/bootstrap/${POINTER_VERSION}/bootstrap.json`,
  ]);
  assert.equal(
    calls.some((url) => url.includes('/api/public/')),
    false,
  );
});

test('legacy schema-v4 direct bootstrap without protocol avoids Worker fallback', async () => {
  const pointer = pointerFixture();
  const calls = [];
  const legacySnapshot = publishedBootstrapFixture(pointer);
  delete legacySnapshot.protocol;
  const originalFetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url === `${CDN_ORIGIN}/public/current.json`) return jsonResponse(pointer);
    if (url === `${CDN_ORIGIN}/public/bootstrap/${POINTER_VERSION}/bootstrap.json`) {
      return jsonResponse(legacySnapshot);
    }
    throw new Error(`Unexpected Worker request: ${url}`);
  };
  const wrapped = createPublicContentFetch(
    originalFetch,
    APP_ORIGIN,
    Date.now,
    CDN_ORIGIN,
  );

  const bootstrap = await withMockedFetch(wrapped, () =>
    loadStorefrontBootstrap(APP_ORIGIN),
  );

  assert.equal(bootstrap.site.site.name, 'Example Site');
  assert.deepEqual(calls, [
    `${CDN_ORIGIN}/public/current.json`,
    `${CDN_ORIGIN}/public/bootstrap/${POINTER_VERSION}/bootstrap.json`,
  ]);
});

test('CDN failure falls back once to the R2-only Worker bootstrap', async () => {
  const calls = [];
  const originalFetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url === `${CDN_ORIGIN}/public/current.json`) {
      return jsonResponse({ unavailable: true }, 503);
    }
    if (url === WORKER_BOOTSTRAP_URL) {
      return jsonResponse(workerBootstrapFixture());
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  const wrapped = createPublicContentFetch(
    originalFetch,
    APP_ORIGIN,
    Date.now,
    CDN_ORIGIN,
  );

  const bootstrap = await withMockedFetch(wrapped, () =>
    loadStorefrontBootstrap(APP_ORIGIN),
  );
  assert.equal(bootstrap.site.site.name, 'Example Site');
  assert.deepEqual(calls, [`${CDN_ORIGIN}/public/current.json`, WORKER_BOOTSTRAP_URL]);
});

test('invalid direct JSON falls back to the R2-only Worker bootstrap', async () => {
  const calls = [];
  const originalFetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url === `${CDN_ORIGIN}/public/current.json`)
      return jsonResponse(pointerFixture());
    if (url === `${CDN_ORIGIN}/public/bootstrap/${POINTER_VERSION}/bootstrap.json`) {
      return new Response('{', {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    if (url === WORKER_BOOTSTRAP_URL) {
      return jsonResponse(workerBootstrapFixture());
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  const wrapped = createPublicContentFetch(
    originalFetch,
    APP_ORIGIN,
    Date.now,
    CDN_ORIGIN,
  );

  const bootstrap = await withMockedFetch(wrapped, () =>
    loadStorefrontBootstrap(APP_ORIGIN),
  );
  assert.equal(bootstrap.site.site.name, 'Example Site');
  assert.deepEqual(calls, [
    `${CDN_ORIGIN}/public/current.json`,
    `${CDN_ORIGIN}/public/bootstrap/${POINTER_VERSION}/bootstrap.json`,
    WORKER_BOOTSTRAP_URL,
  ]);
});

for (const [name, mutate] of [
  ['invalid protocol schema', (snapshot) => ({ ...snapshot, schemaVersion: 99 })],
  [
    'pointer mismatch',
    (snapshot) => ({ ...snapshot, pointerVersion: 'content-20260908-mismatch' }),
  ],
  [
    'incomplete runtime',
    (snapshot) => ({
      ...snapshot,
      site: {
        ...snapshot.site,
        site: { ...snapshot.site.site, runtime: { mediaBaseUrl: CDN_ORIGIN } },
      },
    }),
  ],
]) {
  test(`corrupt direct ${name} plus invalid Worker bootstrap fails closed without legacy D1 recovery`, async () => {
    const calls = [];
    const originalFetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url === `${CDN_ORIGIN}/public/current.json`)
        return jsonResponse(pointerFixture());
      if (url === `${CDN_ORIGIN}/public/bootstrap/${POINTER_VERSION}/bootstrap.json`) {
        return jsonResponse(mutate(publishedBootstrapFixture()));
      }
      if (url === WORKER_BOOTSTRAP_URL) {
        return jsonResponse({ available: false }, 404);
      }
      throw new Error(`Legacy recovery escaped transport closure: ${url}`);
    };
    const wrapped = createPublicContentFetch(
      originalFetch,
      APP_ORIGIN,
      Date.now,
      CDN_ORIGIN,
    );

    await assert.rejects(
      withMockedFetch(wrapped, () => loadStorefrontBootstrap(APP_ORIGIN)),
      (error) => error?.code === 'CONTENT_UNAVAILABLE',
    );
    assert.deepEqual(calls, [
      `${CDN_ORIGIN}/public/current.json`,
      `${CDN_ORIGIN}/public/bootstrap/${POINTER_VERSION}/bootstrap.json`,
      WORKER_BOOTSTRAP_URL,
    ]);
    assert.equal(
      calls.some((url) => url.includes('media-base-url')),
      false,
    );
    assert.equal(
      calls.some((url) => url.includes('/api/public/theme')),
      false,
    );
    assert.equal(
      calls.some((url) => url.includes('bottom-navigation')),
      false,
    );
  });
}

test('Cloudflare challenge on direct pointer uses the single Worker bootstrap fallback', async () => {
  const calls = [];
  const originalFetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url === `${CDN_ORIGIN}/public/current.json`) {
      return new Response('<html>Just a moment...</html>', {
        status: 403,
        headers: {
          'content-type': 'text/html; charset=UTF-8',
          'cf-mitigated': 'challenge',
        },
      });
    }
    if (url === WORKER_BOOTSTRAP_URL) {
      return jsonResponse(workerBootstrapFixture());
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  const wrapped = createPublicContentFetch(
    originalFetch,
    APP_ORIGIN,
    Date.now,
    CDN_ORIGIN,
  );
  const bootstrap = await withMockedFetch(wrapped, () =>
    loadStorefrontBootstrap(APP_ORIGIN),
  );
  assert.equal(bootstrap.site.site.name, 'Example Site');
  assert.deepEqual(calls, [`${CDN_ORIGIN}/public/current.json`, WORKER_BOOTSTRAP_URL]);
});

test('legacy cross-origin snapshot URLs remain readable during client upgrades', async () => {
  const calls = [];
  const wrapped = createPublicContentFetch(async (input) => {
    calls.push(String(input));
    return jsonResponse({ schemaVersion: 2 });
  }, APP_ORIGIN);

  const response = await wrapped('https://media.example.com/public/current.json');
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ['https://media.example.com/public/current.json']);
});

test('public content transport does not inject realtime domain state into snapshots', async () => {
  const calls = [];
  const snapshot = {
    schemaVersion: 2,
    moduleKey: 'section:section-1',
    product: { id: 'product-1', title: 'Product' },
  };
  const wrapped = createPublicContentFetch(async (input) => {
    calls.push(String(input));
    return jsonResponse(snapshot, 200, { etag: 'snapshot-etag' });
  }, APP_ORIGIN);

  const response = await wrapped(
    'https://media.example.com/public/modules/sections/section-1/version-1/products/product-1.json',
  );
  assert.deepEqual(await response.json(), snapshot);
  assert.equal(response.headers.get('etag'), 'snapshot-etag');
  assert.deepEqual(calls, [
    'https://media.example.com/public/modules/sections/section-1/version-1/products/product-1.json',
  ]);
});

test('legacy cross-origin challenges fall back to the same-origin Worker', async () => {
  let now = 1_000;
  const calls = [];
  const wrapped = createPublicContentFetch(
    async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.startsWith('https://media.example.com/')) {
        return new Response('<html>Just a moment...</html>', {
          status: 403,
          headers: {
            'content-type': 'text/html; charset=UTF-8',
            'cf-mitigated': 'challenge',
          },
        });
      }
      return jsonResponse({ ok: true });
    },
    APP_ORIGIN,
    () => now,
  );

  const pointer = await wrapped('https://media.example.com/public/current.json');
  assert.equal(pointer.status, 200);
  assert.deepEqual(calls, [
    'https://media.example.com/public/current.json',
    `${APP_ORIGIN}/public/current.json`,
  ]);

  calls.length = 0;
  const moduleResponse = await wrapped(
    'https://media.example.com/public/modules/site/version/site.json',
  );
  assert.equal(moduleResponse.status, 200);
  assert.deepEqual(calls, [`${APP_ORIGIN}/public/modules/site/version/site.json`]);

  now += 5 * 60_000 + 1;
  calls.length = 0;
  await wrapped('https://media.example.com/public/current.json');
  assert.equal(calls[0], 'https://media.example.com/public/current.json');
});

test('legacy JSON transport falls back while media retries stay component-owned', async () => {
  const calls = [];
  const wrapped = createPublicContentFetch(async (input) => {
    const url = String(input);
    calls.push(url);
    if (url === 'https://media.example.com/public/current.json') {
      throw new TypeError('Failed to fetch');
    }
    if (url === 'https://media.example.com/products/product-a/cover.webp') {
      return new Response('blocked', { status: 403 });
    }
    return jsonResponse({ ok: true });
  }, APP_ORIGIN);

  const contentResponse = await wrapped('https://media.example.com/public/current.json');
  assert.equal(contentResponse.status, 200);
  assert.deepEqual(calls.slice(0, 2), [
    'https://media.example.com/public/current.json',
    `${APP_ORIGIN}/public/current.json`,
  ]);

  const mediaResponse = await wrapped(
    'https://media.example.com/products/product-a/cover.webp',
  );
  assert.equal(mediaResponse.status, 403);
  assert.equal(calls.at(-1), 'https://media.example.com/products/product-a/cover.webp');
});

test('aborted public requests are not retried through the fallback route', async () => {
  const controller = new AbortController();
  controller.abort();
  const calls = [];
  const wrapped = createPublicContentFetch(async (input) => {
    calls.push(String(input));
    throw new DOMException('Aborted', 'AbortError');
  }, APP_ORIGIN);

  await assert.rejects(
    wrapped('https://media.example.com/public/current.json', {
      signal: controller.signal,
    }),
    (error) => error?.name === 'AbortError',
  );
  assert.deepEqual(calls, ['https://media.example.com/public/current.json']);
});
