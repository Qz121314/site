import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import {
  serveRobots,
  serveSitemap,
  serveStorefrontDocument,
} from '../src/routes/public-seo.ts';

const pointer = {
  schemaVersion: 2,
  contentVersion: 'pointer-v1',
  publishedAt: '2026-08-12T10:00:00.000Z',
  site: {
    contentVersion: 'site-v1',
    manifestKey: 'public/modules/site/site-v1/manifest.json',
    publishedAt: '2026-08-12T10:00:00.000Z',
  },
  sectionsIndex: {
    contentVersion: 'index-v1',
    manifestKey: 'public/modules/sections-index/index-v1/manifest.json',
    publishedAt: '2026-08-12T10:00:00.000Z',
  },
  faq: {
    contentVersion: 'faq-v1',
    manifestKey: 'public/modules/faq/faq-v1/manifest.json',
    publishedAt: '2026-08-12T10:00:00.000Z',
  },
  sections: {
    'section-1': {
      contentVersion: 'section-v1',
      manifestKey: 'public/modules/sections/section-1/section-v1/manifest.json',
      publishedAt: '2026-08-12T10:00:00.000Z',
    },
  },
};

const objects = new Map([
  ['public/current.json', pointer],
  [
    'public/modules/site/site-v1/site.json',
    {
      site: { name: 'EROSDOOR', locationLabel: 'Private services in Los Angeles' },
    },
  ],
  [
    'public/modules/sections-index/index-v1/sections.json',
    {
      sections: [
        {
          id: 'section-1',
          slug: 'escorts',
          name: 'Escorts',
          description: 'Curated private services.',
          browseBackgroundObjectKey: 'media/section.webp',
        },
      ],
    },
  ],
  [
    'public/modules/faq/faq-v1/faq.json',
    { faqs: [{ id: 'booking', title: 'How to book', body: 'Choose a listing.' }] },
  ],
  [
    'public/modules/sections/section-1/section-v1/section.json',
    {
      products: [
        {
          id: 'product-1',
          slug: 'los-angeles',
          sectionId: 'section-1',
          title: 'Los Angeles',
          address: 'Los Angeles, CA',
          coverObjectKey: 'media/product.webp',
        },
      ],
    },
  ],
  [
    'public/modules/sections/section-1/section-v1/products/product-1.json',
    {
      product: {
        id: 'product-1',
        slug: 'los-angeles',
        sectionId: 'section-1',
        title: 'Los Angeles',
        address: 'Los Angeles, CA',
        coverObjectKey: 'media/product.webp',
        body: '**Private appointment** in Los Angeles.',
        media: [],
      },
    },
  ],
]);

function env() {
  return {
    ASSETS_BUCKET: {
      async get(key) {
        const value = objects.get(key);
        return value
          ? {
              async text() {
                return JSON.stringify(value);
              },
            }
          : null;
      },
    },
    ASSETS: {
      async fetch() {
        return new Response(
          '<!doctype html><html><head><title>Service Catalog</title></head><body><div id="root"></div></body></html>',
          { headers: { 'content-type': 'text/html; charset=utf-8' } },
        );
      },
    },
  };
}

const app = new Hono();
app.on(['GET', 'HEAD'], '/robots.txt', serveRobots);
app.on(['GET', 'HEAD'], '/sitemap.xml', serveSitemap);
app.on(['GET', 'HEAD'], '*', serveStorefrontDocument);

test('SEO routes return real robots text and a published-content sitemap', async () => {
  const robots = await app.request('https://example.com/robots.txt', {}, env());
  assert.equal(robots.status, 200);
  assert.match(robots.headers.get('content-type'), /^text\/plain/u);
  assert.match(await robots.text(), /Sitemap: https:\/\/example\.com\/sitemap\.xml/u);

  const sitemap = await app.request('https://example.com/sitemap.xml', {}, env());
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get('content-type'), /^application\/xml/u);
  const xml = await sitemap.text();
  assert.match(xml, /https:\/\/example\.com\/sections\/escorts\//u);
  assert.match(
    xml,
    /https:\/\/example\.com\/sections\/escorts\/products\/los-angeles\//u,
  );
  assert.match(xml, /https:\/\/example\.com\/faq\/booking\//u);
});

test('Storefront HTML has route metadata, canonical URLs and structured data', async () => {
  const response = await app.request(
    'https://example.com/sections/escorts/products/los-angeles/',
    {},
    env(),
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Los Angeles · EROSDOOR<\/title>/u);
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/example\.com\/sections\/escorts\/products\/los-angeles\/"/u,
  );
  assert.match(html, /<meta property="og:image"/u);
  assert.match(html, /application\/ld\+json/u);
});

test('Storefront normalizes valid routes and returns a real noindex 404', async () => {
  const redirect = await app.request('https://example.com/sections/escorts', {}, env());
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), 'https://example.com/sections/escorts/');

  const missing = await app.request('https://example.com/not-real', {}, env());
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.match(await missing.text(), /<meta name="robots" content="noindex, nofollow"/u);
});
