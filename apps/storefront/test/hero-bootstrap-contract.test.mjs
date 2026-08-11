import assert from 'node:assert/strict';
import test from 'node:test';
import { loadStorefrontBootstrap } from '../src/content.ts';

const POINTER_VERSION = '20260811080000-pointer-abcdef12';
const SITE_VERSION = '20260811080100-site-abcdef1234';
const INDEX_VERSION = '20260811080200-index-abcdef123';
const FAQ_VERSION = '20260811080300-faq-abcdef12345';

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
    publishedAt: '2026-08-11T08:00:00.000Z',
  };
}

test('schema-v2 bootstrap owns Hero data and resolves Hero media through runtime media config', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);

    if (url === '/api/public/storefront/media-base-url') {
      return jsonResponse({ mediaBaseUrl: 'https://media-runtime.example.com' });
    }
    if (url === 'https://app.example.com/public/current.json') {
      return jsonResponse({
        schemaVersion: 2,
        contentVersion: POINTER_VERSION,
        publishedAt: '2026-08-11T08:00:00.000Z',
        site: reference(SITE_VERSION, 'public/modules/site'),
        sectionsIndex: reference(INDEX_VERSION, 'public/modules/sections-index'),
        faq: reference(FAQ_VERSION, 'public/modules/faq'),
        sections: {},
      });
    }
    if (
      url ===
      `https://app.example.com/public/modules/site/${SITE_VERSION}/site.json`
    ) {
      return jsonResponse({
        schemaVersion: 2,
        moduleKey: 'site',
        contentVersion: SITE_VERSION,
        publishedAt: '2026-08-11T08:01:00.000Z',
        site: {
          name: 'Directory',
          locationLabel: 'City',
          mediaBaseUrl: 'https://legacy-media.example.com',
          logoObjectKey: 'branding/logo.webp',
          homeSectionLimit: 5,
          hero: {
            slides: [
              {
                id: 'hero-1',
                media: {
                  kind: 'image',
                  objectKey: 'hero/cover image.webp',
                },
                title: 'Published Hero',
                description: 'Published description',
                cta: { label: 'Open', href: '/browse/' },
                sortOrder: 0,
              },
            ],
          },
          navigation: {
            showHot: true,
            showLatest: true,
            showMore: true,
            showFaq: true,
          },
          analytics: { ga4MeasurementId: null },
        },
      });
    }
    if (
      url ===
      `https://app.example.com/public/modules/sections-index/${INDEX_VERSION}/sections.json`
    ) {
      return jsonResponse({
        schemaVersion: 2,
        moduleKey: 'sections-index',
        contentVersion: INDEX_VERSION,
        publishedAt: '2026-08-11T08:02:00.000Z',
        sections: [],
      });
    }
    if (url === `https://app.example.com/public/home/${POINTER_VERSION}/home.json`) {
      return jsonResponse({
        schemaVersion: 2,
        pointerVersion: POINTER_VERSION,
        publishedAt: '2026-08-11T08:00:00.000Z',
        featuredProducts: [],
        latestProducts: [],
      });
    }

    return jsonResponse({}, 404);
  };

  try {
    const bootstrap = await loadStorefrontBootstrap('https://app.example.com');

    assert.equal(
      bootstrap.site.site.mediaBaseUrl,
      'https://media-runtime.example.com',
    );
    assert.equal(
      bootstrap.site.site.logoUrl,
      'https://media-runtime.example.com/branding/logo.webp',
    );
    assert.deepEqual(bootstrap.site.site.hero, {
      slides: [
        {
          id: 'hero-1',
          mediaKind: 'image',
          mediaUrl: 'https://media-runtime.example.com/hero/cover%20image.webp',
          title: 'Published Hero',
          description: 'Published description',
          cta: { label: 'Open', href: '/browse/' },
        },
      ],
    });
    assert.equal(
      requests.filter((url) => url.endsWith(`/site/${SITE_VERSION}/site.json`)).length,
      1,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
