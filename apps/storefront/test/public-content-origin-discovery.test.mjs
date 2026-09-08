import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPublicContentFetch,
  STOREFRONT_DIRECT_BOOTSTRAP_SCHEMA_CURRENT,
  STOREFRONT_DIRECT_BOOTSTRAP_SCHEMA_MIN_READABLE,
} from '../src/public-content-transport.ts';

const APP_ORIGIN = 'https://app.example.com';
const CDN_ORIGIN = 'https://cdn.example.com';
const OLD_CDN_ORIGIN = 'https://old-cdn.example.com';
const POINTER_VERSION = 'content-20260908-abcdef';
const WORKER_BOOTSTRAP_URL = `${APP_ORIGIN}/api/public/storefront/bootstrap`;

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
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

function siteEnvelopeFixture(pointer = pointerFixture(), mediaBaseUrl = CDN_ORIGIN) {
  return {
    schemaVersion: 2,
    moduleKey: 'site',
    contentVersion: pointer.site.contentVersion,
    publishedAt: pointer.site.publishedAt,
    site: {
      navigation: { messageArticles: [] },
      runtime: {
        mediaBaseUrl,
        theme: { key: 'default' },
        bottomNavigation: [],
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

function publishedBootstrapFixture(pointer = pointerFixture(), mediaBaseUrl = CDN_ORIGIN) {
  return {
    schemaVersion: STOREFRONT_DIRECT_BOOTSTRAP_SCHEMA_CURRENT,
    protocol: {
      schemaVersion: STOREFRONT_DIRECT_BOOTSTRAP_SCHEMA_CURRENT,
      minReadableSchemaVersion: STOREFRONT_DIRECT_BOOTSTRAP_SCHEMA_MIN_READABLE,
      capabilities: [],
    },
    pointerVersion: pointer.contentVersion,
    site: siteEnvelopeFixture(pointer, mediaBaseUrl),
    sectionsIndex: sectionsEnvelopeFixture(pointer),
    home: homeEnvelopeFixture(),
  };
}

function workerBootstrapFixture(pointer = pointerFixture(), mediaBaseUrl = CDN_ORIGIN) {
  const published = publishedBootstrapFixture(pointer, mediaBaseUrl);
  return {
    pointer,
    site: published.site,
    sectionsIndex: published.sectionsIndex,
    home: published.home,
    mediaBaseUrl,
    theme: { key: 'default' },
    bottomNavigation: [],
  };
}

function memoryOriginStore(initialValue = null) {
  let value = initialValue;
  return {
    get: () => value,
    set: (nextValue) => {
      value = nextValue;
    },
    clear: () => {
      value = null;
    },
    value: () => value,
  };
}

test('cold bootstrap learns the Admin-published CDN origin and the next bootstrap is Worker-free', async () => {
  const pointer = pointerFixture();
  const calls = [];
  const store = memoryOriginStore();
  const originalFetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url === WORKER_BOOTSTRAP_URL) return jsonResponse(workerBootstrapFixture(pointer));
    if (url === `${CDN_ORIGIN}/public/current.json`) return jsonResponse(pointer);
    if (url === `${CDN_ORIGIN}/public/bootstrap/${POINTER_VERSION}/bootstrap.json`) {
      return jsonResponse(publishedBootstrapFixture(pointer));
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  const wrapped = createPublicContentFetch(
    originalFetch,
    APP_ORIGIN,
    Date.now,
    null,
    store,
  );

  const coldResponse = await wrapped(WORKER_BOOTSTRAP_URL);
  assert.equal(coldResponse.status, 200);
  assert.equal(store.value(), CDN_ORIGIN);
  assert.deepEqual(calls, [WORKER_BOOTSTRAP_URL]);

  calls.length = 0;
  const warmResponse = await wrapped(WORKER_BOOTSTRAP_URL);
  assert.equal(warmResponse.status, 200);
  assert.deepEqual(calls, [
    `${CDN_ORIGIN}/public/current.json`,
    `${CDN_ORIGIN}/public/bootstrap/${POINTER_VERSION}/bootstrap.json`,
  ]);
  assert.equal(calls.some((url) => url.includes('/api/public/')), false);
});

test('stale cached CDN origin falls back to the R2-only Worker bootstrap and self-heals', async () => {
  const pointer = pointerFixture();
  const calls = [];
  const store = memoryOriginStore(OLD_CDN_ORIGIN);
  const originalFetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url === `${OLD_CDN_ORIGIN}/public/current.json`) {
      return jsonResponse({ unavailable: true }, 503);
    }
    if (url === WORKER_BOOTSTRAP_URL) return jsonResponse(workerBootstrapFixture(pointer));
    if (url === `${CDN_ORIGIN}/public/current.json`) return jsonResponse(pointer);
    if (url === `${CDN_ORIGIN}/public/bootstrap/${POINTER_VERSION}/bootstrap.json`) {
      return jsonResponse(publishedBootstrapFixture(pointer));
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  const wrapped = createPublicContentFetch(
    originalFetch,
    APP_ORIGIN,
    Date.now,
    null,
    store,
  );

  const recoveredResponse = await wrapped(WORKER_BOOTSTRAP_URL);
  assert.equal(recoveredResponse.status, 200);
  assert.equal(store.value(), CDN_ORIGIN);
  assert.deepEqual(calls, [
    `${OLD_CDN_ORIGIN}/public/current.json`,
    WORKER_BOOTSTRAP_URL,
  ]);
  assert.equal(calls.some((url) => url.includes('media-base-url')), false);

  calls.length = 0;
  await wrapped(WORKER_BOOTSTRAP_URL);
  assert.deepEqual(calls, [
    `${CDN_ORIGIN}/public/current.json`,
    `${CDN_ORIGIN}/public/bootstrap/${POINTER_VERSION}/bootstrap.json`,
  ]);
});
