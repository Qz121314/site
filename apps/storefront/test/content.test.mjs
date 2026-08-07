import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PublicContentError,
  loadStorefrontBootstrap,
  normalizeContentOrigin,
  publicContentUrl,
} from '../src/content.ts';

const VERSION = '20260807074900-abcdef123456-deadbeef';

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

test('content origin normalization accepts public HTTP(S) URLs and removes the trailing slash', () => {
  assert.equal(normalizeContentOrigin(' https://cdn.example.com/ '), 'https://cdn.example.com');
  assert.equal(normalizeContentOrigin('http://localhost:8787/'), 'http://localhost:8787');
  assert.equal(normalizeContentOrigin('javascript:alert(1)'), null);
  assert.equal(normalizeContentOrigin('https://user:pass@example.com/'), null);
  assert.equal(normalizeContentOrigin('https://cdn.example.com/?token=secret'), null);
  assert.equal(normalizeContentOrigin(''), null);
});

test('public content URLs stay on the configured R2 custom domain', () => {
  assert.equal(
    publicContentUrl('https://cdn.example.com/', '/public/current.json'),
    'https://cdn.example.com/public/current.json',
  );
});

test('bootstrap reads current.json first and then immutable site/home files from the selected version', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, cache: init?.cache });
    if (url.endsWith('/public/current.json')) {
      return jsonResponse({
        schemaVersion: 1,
        contentVersion: VERSION,
        manifestKey: `public/versions/${VERSION}/manifest.json`,
        sourceRevision: 'source-revision',
        publishedAt: '2026-08-07T07:49:00.000Z',
      });
    }
    if (url.endsWith('/site.json')) {
      return jsonResponse({
        schemaVersion: 1,
        contentVersion: VERSION,
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
        contentVersion: VERSION,
        publishedAt: '2026-08-07T07:49:00.000Z',
        sections: [],
        allSections: [],
        featuredProducts: [],
        latestProducts: [],
      });
    }
    return jsonResponse({}, 404);
  };

  try {
    const result = await loadStorefrontBootstrap('https://cdn.example.com');
    assert.equal(result.pointer.contentVersion, VERSION);
    assert.equal(result.site.site.name, 'Directory');
    assert.equal(result.origin, 'https://cdn.example.com');
    assert.deepEqual(requests, [
      { url: 'https://cdn.example.com/public/current.json', cache: 'no-cache' },
      { url: `https://cdn.example.com/public/versions/${VERSION}/site.json`, cache: 'force-cache' },
      { url: `https://cdn.example.com/public/versions/${VERSION}/home.json`, cache: 'force-cache' },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('bootstrap rejects a snapshot whose contentVersion does not match current.json', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/public/current.json')) {
      return jsonResponse({
        schemaVersion: 1,
        contentVersion: VERSION,
        manifestKey: `public/versions/${VERSION}/manifest.json`,
        sourceRevision: 'source-revision',
        publishedAt: '2026-08-07T07:49:00.000Z',
      });
    }
    return jsonResponse({
      schemaVersion: 1,
      contentVersion: '20260807075000-other-version-12345678',
      publishedAt: '2026-08-07T07:50:00.000Z',
      site: {},
      sections: [],
      allSections: [],
      featuredProducts: [],
      latestProducts: [],
    });
  };

  try {
    await assert.rejects(
      loadStorefrontBootstrap('https://cdn.example.com'),
      (error) => error instanceof PublicContentError && error.code === 'SNAPSHOT_VERSION_MISMATCH',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
