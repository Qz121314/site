import assert from 'node:assert/strict';
import test from 'node:test';
import { PublicContentError } from '../src/content.ts';
import { loadArticleSnapshot } from '../src/content-route.ts';

const V1_VERSION = '20260906080000-legacyarticle-acde0001';
const POINTER_VERSION = '20260906080100-pointerarticle-acde0002';
const FAQ_VERSION = '20260906080200-faqarticle123-acde0003';

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function moduleReference(contentVersion) {
  return {
    contentVersion,
    manifestKey: `public/modules/faq/${contentVersion}/manifest.json`,
    sourceRevision: `source-${contentVersion}`,
    publishedAt: '2026-09-06T08:02:00.000Z',
  };
}

function v2Bootstrap() {
  return {
    origin: 'https://content.example.com',
    pointer: {
      schemaVersion: 2,
      contentVersion: POINTER_VERSION,
      publishedAt: '2026-09-06T08:01:00.000Z',
      site: moduleReference('20260906080300-sitearticle12-acde0004'),
      sectionsIndex: moduleReference('20260906080400-indexarticle1-acde0005'),
      faq: moduleReference(FAQ_VERSION),
      sections: {},
    },
  };
}

function v1Bootstrap() {
  return {
    origin: 'https://content.example.com',
    pointer: {
      schemaVersion: 1,
      contentVersion: V1_VERSION,
      manifestKey: `public/versions/${V1_VERSION}/manifest.json`,
      sourceRevision: 'legacy-source',
      publishedAt: '2026-09-06T08:00:00.000Z',
    },
  };
}

function articlesEnvelope(schemaVersion, contentVersion) {
  return {
    schemaVersion,
    ...(schemaVersion === 2 ? { moduleKey: 'faq' } : {}),
    contentVersion,
    publishedAt: '2026-09-06T08:02:00.000Z',
    articles: [
      { id: 'article-a', title: 'Alpha', body: '# Alpha body', sortOrder: 20 },
      { id: 'article-b', title: 'Beta', body: '**Full Markdown body**', sortOrder: 10 },
    ],
  };
}

test('generic article detail lazy-loads articles.json from the current faq module and selects one article', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), cache: init?.cache });
    return jsonResponse(articlesEnvelope(2, FAQ_VERSION));
  };

  try {
    const article = await loadArticleSnapshot(v2Bootstrap(), 'article-b');
    assert.deepEqual(article, {
      id: 'article-b',
      title: 'Beta',
      body: '**Full Markdown body**',
      sortOrder: 10,
    });
    assert.deepEqual(requests, [
      {
        url: `https://content.example.com/public/modules/faq/${FAQ_VERSION}/articles.json`,
        cache: 'force-cache',
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generic article loader reports the existing public not-found contract for a missing article', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse(articlesEnvelope(2, FAQ_VERSION));

  try {
    await assert.rejects(
      loadArticleSnapshot(v2Bootstrap(), 'missing-article'),
      (error) =>
        error instanceof PublicContentError && error.code === 'CONTENT_NOT_PUBLISHED',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('schema-v1 generic article loading remains compatible when articles.json exists', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), cache: init?.cache });
    return jsonResponse(articlesEnvelope(1, V1_VERSION));
  };

  try {
    const article = await loadArticleSnapshot(v1Bootstrap(), 'article-a');
    assert.equal(article.id, 'article-a');
    assert.equal(article.body, '# Alpha body');
    assert.deepEqual(requests, [
      {
        url: `https://content.example.com/public/versions/${V1_VERSION}/articles.json`,
        cache: 'force-cache',
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
