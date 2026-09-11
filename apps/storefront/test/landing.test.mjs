import assert from 'node:assert/strict';
import test from 'node:test';
import { loadLandingSnapshot } from '../src/landing/landing-content.ts';

test('Landing snapshot uses its independent immutable publication artifact', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  let version = 'version-1';
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('/pointers/')) {
      return new Response(
        JSON.stringify({
          schemaVersion: 1,
          slug: 'summer-offer',
          artifactKey: `public/landing-publications/v1/artifacts/landing-1/${version}.json`,
          publishedAt: '2026-09-11T00:00:00.000Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response(
      JSON.stringify({
        schemaVersion: 1,
        model: {
          landing: { slug: 'summer-offer', name: 'Summer Offer' },
          templateKey: 'direct_response',
          product: {
            id: 'product-hidden',
            media: [{ id: 'media-1', publicUrl: 'https://cdn/media.webp' }],
          },
          resolved: {
            headline: 'Custom headline',
            subheadline: null,
            body: '# Body',
            heroAsset: {
              assetId: 'asset-hero',
              objectKey: 'media/hero.webp',
              publicUrl: 'https://cdn/hero.webp',
              width: 1200,
              height: 900,
            },
            ctaLabel: 'Contact now',
          },
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };
  try {
    const snapshot = await loadLandingSnapshot('summer-offer');
    assert.equal(snapshot.model.product.id, 'product-hidden');
    assert.equal(snapshot.model.resolved.heroAsset.publicUrl, 'https://cdn/hero.webp');
    assert.deepEqual(calls, [
      '/public/landing-publications/v1/pointers/summer-offer.json',
      '/public/landing-publications/v1/artifacts/landing-1/version-1.json',
    ]);
    version = 'version-2';
    calls.length = 0;
    const republished = await loadLandingSnapshot('summer-offer');
    assert.equal(republished.model.resolved.headline, 'Custom headline');
    assert.deepEqual(calls, [
      '/public/landing-publications/v1/pointers/summer-offer.json',
      '/public/landing-publications/v1/artifacts/landing-1/version-2.json',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Landing snapshot rejects missing publication artifacts', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 404 });
  try {
    await assert.rejects(
      loadLandingSnapshot('missing'),
      (error) => error?.code === 'CONTENT_NOT_PUBLISHED',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
