import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublicContentFetch } from '../src/public-content-transport.ts';

function jsonResponse(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

test('public snapshot reads stay on the R2 custom domain when direct access succeeds', async () => {
  const calls = [];
  const wrapped = createPublicContentFetch(async (input) => {
    calls.push(String(input));
    return jsonResponse({ schemaVersion: 2 });
  }, 'https://app.example.com');

  const response = await wrapped('https://media.example.com/public/current.json');
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ['https://media.example.com/public/current.json']);
});

test('product snapshots are hydrated with realtime CTA state from the Worker', async () => {
  const calls = [];
  const wrapped = createPublicContentFetch(async (input) => {
    const url = String(input);
    calls.push(url);
    if (url === 'https://app.example.com/api/public/storefront/cta/product-1') {
      return jsonResponse({
        available: true,
        label: 'Contact now',
        mode: 'link',
        path: '/go/product-1',
      });
    }
    return jsonResponse({
      schemaVersion: 2,
      moduleKey: 'section:section-1',
      product: { id: 'product-1', title: 'Product' },
    }, 200, { etag: 'snapshot-etag' });
  }, 'https://app.example.com');

  const response = await wrapped(
    'https://media.example.com/public/modules/sections/section-1/version-1/products/product-1.json',
  );
  const body = await response.json();
  assert.deepEqual(body.product.cta, {
    label: 'Contact now',
    mode: 'link',
    path: '/go/product-1',
  });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('etag'), null);
  assert.deepEqual(calls, [
    'https://media.example.com/public/modules/sections/section-1/version-1/products/product-1.json',
    'https://app.example.com/api/public/storefront/cta/product-1',
  ]);
});

test('unavailable realtime CTA removes stale CTA data from an older snapshot', async () => {
  const wrapped = createPublicContentFetch(async (input) => {
    const url = String(input);
    if (url === 'https://app.example.com/api/public/storefront/cta/product-1') {
      return jsonResponse({ available: false });
    }
    return jsonResponse({
      schemaVersion: 1,
      product: {
        id: 'product-1',
        cta: { label: 'Old CTA', mode: 'link', path: '/go/product-1' },
      },
    });
  }, 'https://app.example.com');

  const response = await wrapped(
    'https://media.example.com/public/versions/version-1/products/product-1.json',
  );
  const body = await response.json();
  assert.equal(body.product.cta, null);
});

test('Cloudflare challenge falls back to same-origin Worker and opens a short circuit breaker', async () => {
  let now = 1_000;
  const calls = [];
  const wrapped = createPublicContentFetch(async (input) => {
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
  }, 'https://app.example.com', () => now);

  const pointer = await wrapped('https://media.example.com/public/current.json');
  assert.equal(pointer.status, 200);
  assert.deepEqual(calls, [
    'https://media.example.com/public/current.json',
    'https://app.example.com/public/current.json',
  ]);

  calls.length = 0;
  const moduleResponse = await wrapped(
    'https://media.example.com/public/modules/site/version/site.json',
  );
  assert.equal(moduleResponse.status, 200);
  assert.deepEqual(calls, [
    'https://app.example.com/public/modules/site/version/site.json',
  ]);

  now += 5 * 60_000 + 1;
  calls.length = 0;
  await wrapped('https://media.example.com/public/current.json');
  assert.equal(calls[0], 'https://media.example.com/public/current.json');
});

test('CORS or network failure falls back, while media objects remain direct', async () => {
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
  }, 'https://app.example.com');

  const contentResponse = await wrapped('https://media.example.com/public/current.json');
  assert.equal(contentResponse.status, 200);
  assert.deepEqual(calls.slice(0, 2), [
    'https://media.example.com/public/current.json',
    'https://app.example.com/public/current.json',
  ]);

  const mediaResponse = await wrapped('https://media.example.com/products/product-a/cover.webp');
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
  }, 'https://app.example.com');

  await assert.rejects(
    wrapped('https://media.example.com/public/current.json', { signal: controller.signal }),
    (error) => error?.name === 'AbortError',
  );
  assert.deepEqual(calls, ['https://media.example.com/public/current.json']);
});