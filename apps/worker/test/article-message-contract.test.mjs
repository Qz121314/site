import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Hono } from 'hono';
import {
  getModularPublishStatus,
  publishModularStorefront,
} from '../src/publishing/modular-publisher.ts';
import { adminMessageArticleRoutes } from '../src/routes/admin-message-articles.ts';

const NOW = '2026-09-06T12:00:00.000Z';

function withRequestId(routes) {
  const app = new Hono();
  app.use('*', async (context, next) => {
    context.set('requestId', 'article-message-test-request');
    await next();
  });
  app.route('/', routes);
  return app;
}

function createMessageArticleDb() {
  const articles = new Map([
    ['article-a', { id: 'article-a', question: 'Article A', deleted_at: null }],
    ['article-b', { id: 'article-b', question: 'Article B', deleted_at: null }],
    [
      'article-deleted',
      { id: 'article-deleted', question: 'Deleted article', deleted_at: NOW },
    ],
  ]);
  const media = new Map([
    [
      'media-ready',
      {
        id: 'media-ready',
        status: 'ready',
        deleted_at: null,
        mime_type: 'image/webp',
      },
    ],
    [
      'media-deleted',
      {
        id: 'media-deleted',
        status: 'deleted',
        deleted_at: NOW,
        mime_type: 'image/webp',
      },
    ],
    [
      'media-video',
      { id: 'media-video', status: 'ready', deleted_at: null, mime_type: 'video/mp4' },
    ],
  ]);
  let references = [
    {
      article_id: 'article-a',
      background_media_id: null,
      sort_order: 20,
      is_enabled: 1,
    },
    {
      article_id: 'article-b',
      background_media_id: null,
      sort_order: 10,
      is_enabled: 1,
    },
  ];
  const batches = [];

  return {
    get references() {
      return references.map((reference) => ({ ...reference }));
    },
    batches,
    prepare(sql) {
      const statement = {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async all() {
          if (this.sql.includes('FROM message_article_references mar')) {
            return {
              results: references
                .filter((reference) => !articles.get(reference.article_id)?.deleted_at)
                .map((reference) => ({
                  ...reference,
                  question: articles.get(reference.article_id)?.question,
                }))
                .sort(
                  (left, right) =>
                    left.sort_order - right.sort_order ||
                    left.article_id.localeCompare(right.article_id),
                ),
            };
          }
          if (this.sql.includes('SELECT id FROM faqs')) {
            return {
              results: this.args
                .filter((id) => articles.has(id) && !articles.get(id).deleted_at)
                .map((id) => ({ id })),
            };
          }
          if (this.sql.includes('FROM media_assets')) {
            return {
              results: this.args
                .map((id) => media.get(id))
                .filter(
                  (asset) =>
                    asset &&
                    asset.status === 'ready' &&
                    asset.deleted_at === null &&
                    asset.mime_type.startsWith('image/'),
                )
                .map((asset) => ({ id: asset.id })),
            };
          }
          throw new Error(`Unexpected all SQL: ${this.sql}`);
        },
      };
      return statement;
    },
    async batch(statements) {
      batches.push(
        statements.map((statement) => ({ sql: statement.sql, args: statement.args })),
      );
      for (const statement of statements) {
        if (statement.sql === 'DELETE FROM message_article_references') {
          references = [];
          continue;
        }
        if (statement.sql.includes('INSERT INTO message_article_references')) {
          if (statement.sql.includes('background_media_id')) {
            references.push({
              article_id: statement.args[0],
              background_media_id: statement.args[1],
              sort_order: statement.args[2],
              is_enabled: statement.args[3],
            });
          } else {
            references.push({
              article_id: statement.args[0],
              background_media_id: null,
              sort_order: statement.args[1],
              is_enabled: 1,
            });
          }
        }
      }
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    },
  };
}

test('0031 keeps faqs intact and gives Messages references FK, ordering, and soft-delete pruning', () => {
  const migration = readFileSync(
    new URL('../../../migrations/0031_message_article_references.sql', import.meta.url),
    'utf8',
  );

  assert.match(migration, /CREATE TABLE message_article_references/u);
  assert.match(
    migration,
    /article_id TEXT PRIMARY KEY REFERENCES faqs\(id\) ON DELETE CASCADE/u,
  );
  assert.match(migration, /sort_order INTEGER NOT NULL DEFAULT 0/u);
  assert.match(migration, /is_enabled INTEGER NOT NULL DEFAULT 1/u);
  assert.match(migration, /message_article_references_public_idx/u);
  assert.match(migration, /AFTER UPDATE OF deleted_at ON faqs/u);
  assert.match(
    migration,
    /DELETE FROM message_article_references WHERE article_id = NEW\.id/u,
  );
  assert.doesNotMatch(migration, /DROP TABLE\s+faqs/iu);
  assert.doesNotMatch(migration, /ALTER TABLE\s+faqs/iu);
  assert.doesNotMatch(migration, /RENAME\s+(?:TABLE\s+)?faqs/iu);
});

test('GET /message-articles returns deterministic placement order and compatibility metadata', async () => {
  const db = createMessageArticleDb();
  const app = withRequestId(adminMessageArticleRoutes);
  const response = await app.request('https://admin.example.com/', {}, { DB: db });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    articles: [
      {
        articleId: 'article-b',
        title: 'Article B',
        backgroundMediaId: null,
        sortOrder: 10,
        enabled: true,
        isEnabled: true,
      },
      {
        articleId: 'article-a',
        title: 'Article A',
        backgroundMediaId: null,
        sortOrder: 20,
        enabled: true,
        isEnabled: true,
      },
    ],
  });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('PUT /message-articles replaces the full list and persists input order deterministically', async () => {
  const db = createMessageArticleDb();
  const app = withRequestId(adminMessageArticleRoutes);
  const response = await app.request(
    'https://admin.example.com/',
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
      body: JSON.stringify({ articleIds: ['article-a', 'article-b'] }),
    },
    { DB: db },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    articles: [
      {
        articleId: 'article-a',
        title: 'Article A',
        backgroundMediaId: null,
        sortOrder: 0,
        enabled: true,
        isEnabled: true,
      },
      {
        articleId: 'article-b',
        title: 'Article B',
        backgroundMediaId: null,
        sortOrder: 1,
        enabled: true,
        isEnabled: true,
      },
    ],
  });
  assert.deepEqual(
    db.references.map(({ article_id, sort_order }) => ({ article_id, sort_order })),
    [
      { article_id: 'article-a', sort_order: 0 },
      { article_id: 'article-b', sort_order: 1 },
    ],
  );
  const audit = db.batches
    .at(-1)
    .find((statement) => statement.sql.includes('INSERT INTO audit_logs'));
  assert.ok(audit);
  assert.ok(audit.args.includes('messages.articles_updated'));
  assert.ok(audit.args.includes('message_article_reference'));
});

test('PUT /message-articles accepts placement presentation metadata, null backgrounds, ordering, and enabled state', async () => {
  const db = createMessageArticleDb();
  const app = withRequestId(adminMessageArticleRoutes);
  const response = await app.request(
    'https://admin.example.com/',
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
      body: JSON.stringify({
        articles: [
          {
            articleId: 'article-a',
            backgroundMediaId: 'media-ready',
            isEnabled: false,
          },
          { articleId: 'article-b', backgroundMediaId: null, isEnabled: true },
        ],
      }),
    },
    { DB: db },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    articles: [
      {
        articleId: 'article-a',
        title: 'Article A',
        backgroundMediaId: 'media-ready',
        sortOrder: 0,
        enabled: false,
        isEnabled: false,
      },
      {
        articleId: 'article-b',
        title: 'Article B',
        backgroundMediaId: null,
        sortOrder: 1,
        enabled: true,
        isEnabled: true,
      },
    ],
  });
  assert.deepEqual(db.references, [
    {
      article_id: 'article-a',
      background_media_id: 'media-ready',
      sort_order: 0,
      is_enabled: 0,
    },
    {
      article_id: 'article-b',
      background_media_id: null,
      sort_order: 1,
      is_enabled: 1,
    },
  ]);
});

test('PUT /message-articles rejects unavailable or non-image background media before writes', async () => {
  for (const backgroundMediaId of ['missing-media', 'media-deleted', 'media-video']) {
    const db = createMessageArticleDb();
    const app = withRequestId(adminMessageArticleRoutes);
    const response = await app.request(
      'https://admin.example.com/',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
        body: JSON.stringify({
          articles: [{ articleId: 'article-a', backgroundMediaId }],
        }),
      },
      { DB: db },
    );

    assert.equal(response.status, 400);
    assert.equal(db.batches.length, 0);
  }
});

test('PUT /message-articles rejects duplicate placement article ids before writes', async () => {
  const db = createMessageArticleDb();
  const app = withRequestId(adminMessageArticleRoutes);
  const response = await app.request(
    'https://admin.example.com/',
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
      body: JSON.stringify({
        articles: [
          { articleId: 'article-a', backgroundMediaId: null },
          { articleId: 'article-a', backgroundMediaId: 'media-ready' },
        ],
      }),
    },
    { DB: db },
  );

  assert.equal(response.status, 400);
  assert.equal(db.batches.length, 0);
});

test('PUT /message-articles rejects duplicate, nonexistent, and deleted article ids before writes', async () => {
  for (const articleIds of [
    ['article-a', 'article-a'],
    ['missing-article'],
    ['article-deleted'],
  ]) {
    const db = createMessageArticleDb();
    const app = withRequestId(adminMessageArticleRoutes);
    const response = await app.request(
      'https://admin.example.com/',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
        body: JSON.stringify({ articleIds }),
      },
      { DB: db },
    );

    assert.equal(response.status, 400);
    assert.equal(db.batches.length, 0);
  }
});

test('PUT /message-articles accepts an empty list and clears all placements', async () => {
  const db = createMessageArticleDb();
  const app = withRequestId(adminMessageArticleRoutes);
  const response = await app.request(
    'https://admin.example.com/',
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
      body: JSON.stringify({ articleIds: [] }),
    },
    { DB: db },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { articles: [] });
  assert.deepEqual(db.references, []);
});

test('PUT /message-articles keeps the established admin write header contract', async () => {
  const db = createMessageArticleDb();
  const app = withRequestId(adminMessageArticleRoutes);
  const response = await app.request(
    'https://admin.example.com/',
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ articleIds: [] }),
    },
    { DB: db },
  );

  assert.equal(response.status, 403);
  assert.equal(db.batches.length, 0);
});

const BASE_POINTER = {
  schemaVersion: 2,
  contentVersion: '20260906110000-pointer-before01',
  publishedAt: '2026-09-06T11:00:00.000Z',
  site: {
    contentVersion: 'site-version',
    manifestKey: 'public/modules/site/site-version/manifest.json',
    sourceRevision: 'site-source',
    publishedAt: '2026-09-06T11:00:00.000Z',
  },
  sectionsIndex: {
    contentVersion: 'index-version',
    manifestKey: 'public/modules/sections-index/index-version/manifest.json',
    sourceRevision: 'index-source',
    publishedAt: '2026-09-06T11:00:00.000Z',
  },
  faq: {
    contentVersion: 'faq-before',
    manifestKey: 'public/modules/faq/faq-before/manifest.json',
    sourceRevision: 'faq-old-source',
    publishedAt: '2026-09-06T11:00:00.000Z',
  },
  sections: {},
};

function createPublicationDb() {
  const state = {
    faqs: [
      {
        id: 'article-a',
        question: 'Enabled FAQ article',
        answer:
          '# Welcome **everyone**\n\nRead [the guide](https://example.com).\n\n```js\nprivateExample()\n```',
        sort_order: 10,
        is_enabled: 1,
      },
      {
        id: 'article-b',
        question: 'Messages only article',
        answer: 'Messages article body keeps well-being and stay-ready wording.',
        sort_order: 20,
        is_enabled: 0,
      },
    ],
    messageArticles: [
      {
        article_id: 'article-b',
        question: 'Messages only article',
        answer: 'Messages article body keeps well-being and stay-ready wording.',
        background_object_key: 'media/messages/article-b.webp',
        sort_order: 0,
        is_enabled: 1,
      },
      {
        article_id: 'article-a',
        question: 'Enabled FAQ article',
        answer: '# Welcome **everyone**',
        background_object_key: 'media/messages/disabled.webp',
        sort_order: 1,
        is_enabled: 0,
      },
    ],
  };
  const runs = [];
  const batches = [];

  function rowsFor(sql) {
    if (sql.includes('FROM site_hero_slides')) return [];
    if (sql.includes('FROM categories c')) return [];
    if (sql.includes('FROM product_media pm')) return [];
    if (sql.includes('FROM products p')) return [];
    if (sql.includes('FROM product_tags_catalog t')) return [];
    if (sql.includes('FROM site_home_section_slots')) return [];
    if (sql.includes('FROM message_article_references mar')) {
      return state.messageArticles
        .filter((row) => row.is_enabled !== 0)
        .map((row) => ({ ...row }));
    }
    if (sql.includes('FROM faqs')) return state.faqs.map((row) => ({ ...row }));
    if (sql.includes('FROM sections s')) return [];
    if (sql.includes('FROM publish_module_versions v')) return [];
    if (sql.includes('FROM publish_module_jobs')) return [];
    throw new Error(`Unexpected publication all SQL: ${sql}`);
  }

  return {
    state,
    runs,
    batches,
    prepare(sql) {
      const statement = {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          if (this.sql.includes('FROM site_settings ss')) {
            return {
              site_name: 'Example',
              location_label: 'Anywhere',
              media_base_url: 'https://media.example.com',
              logo_asset_id: null,
              logo_object_key: null,
              home_section_limit: 8,
              show_hot: 1,
              show_latest: 1,
              show_more: 1,
              show_faq: 1,
              ga4_measurement_id: null,
            };
          }
          if (this.sql.includes("WHERE status = 'building'")) return null;
          throw new Error(`Unexpected publication first SQL: ${this.sql}`);
        },
        async all() {
          return { results: rowsFor(this.sql) };
        },
        async run() {
          runs.push({ sql: this.sql, args: [...this.args] });
          return { success: true, meta: { changes: 1 } };
        },
      };
      return statement;
    },
    async batch(statements) {
      batches.push(
        statements.map((statement) => ({ sql: statement.sql, args: statement.args })),
      );
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    },
  };
}

function createPublicationBucket() {
  const objects = new Map([['public/current.json', JSON.stringify(BASE_POINTER)]]);
  const writes = [];
  return {
    objects,
    writes,
    async get(key) {
      const body = objects.get(key);
      if (body === undefined) return null;
      return {
        async text() {
          return body;
        },
      };
    },
    async put(key, body, options) {
      const text = String(body);
      objects.set(key, text);
      writes.push({ key, body: text, options });
      return { key };
    },
    async list() {
      return { objects: [], truncated: false };
    },
    async delete() {},
  };
}

function writtenJson(bucket, suffix) {
  const write = bucket.writes.find((item) => item.key.endsWith(suffix));
  assert.ok(write, `Expected R2 write ending in ${suffix}`);
  return { key: write.key, value: JSON.parse(write.body) };
}

test('faq module atomically publishes legacy FAQ, generic Article, and lightweight Messages files', async () => {
  const db = createPublicationDb();
  const bucket = createPublicationBucket();
  const result = await publishModularStorefront(db, bucket, 'publish-request', 'faq');

  assert.equal(result.publications.length, 1);
  assert.equal(result.publications[0].moduleKey, 'faq');
  assert.equal(result.publications[0].unchanged, false);

  const faq = writtenJson(bucket, '/faq.json');
  const articles = writtenJson(bucket, '/articles.json');
  const messages = writtenJson(bucket, '/messages.json');
  const manifest = writtenJson(bucket, '/manifest.json');

  assert.deepEqual(
    faq.value.faqs.map((article) => article.id),
    ['article-a'],
  );
  assert.deepEqual(
    articles.value.articles.map((article) => article.id),
    ['article-a', 'article-b'],
  );
  assert.deepEqual(messages.value.articles, [
    {
      articleId: 'article-b',
      title: 'Messages only article',
      preview: 'Messages article body keeps well-being and stay-ready wording.',
      backgroundObjectKey: 'media/messages/article-b.webp',
      sortOrder: 0,
    },
  ]);
  assert.equal(
    messages.value.articles.some((article) => 'body' in article),
    false,
  );
  assert.equal(JSON.stringify(messages.value).includes('privateExample'), false);
  assert.deepEqual(manifest.value.files.map((file) => file.path).sort(), [
    'articles.json',
    'faq.json',
    'messages.json',
  ]);
  assert.equal(faq.value.contentVersion, articles.value.contentVersion);
  assert.equal(articles.value.contentVersion, messages.value.contentVersion);
  assert.equal(messages.value.contentVersion, manifest.value.contentVersion);

  const pointer = JSON.parse(bucket.objects.get('public/current.json'));
  assert.equal(pointer.schemaVersion, 2);
  assert.equal(pointer.faq.contentVersion, messages.value.contentVersion);
  assert.equal(pointer.faq.manifestKey, manifest.key);
});

test('faq publication keeps a placement and publishes null when background media is unavailable', async () => {
  const db = createPublicationDb();
  db.state.messageArticles[0].background_object_key = null;
  const bucket = createPublicationBucket();

  await publishModularStorefront(db, bucket, 'publish-request-missing-background', 'faq');
  const messages = writtenJson(bucket, '/messages.json');
  assert.deepEqual(messages.value.articles, [
    {
      articleId: 'article-b',
      title: 'Messages only article',
      preview: 'Messages article body keeps well-being and stay-ready wording.',
      backgroundObjectKey: null,
      sortOrder: 0,
    },
  ]);
});

test('Article content and Messages placement both make the shared faq publication module dirty', async () => {
  const db = createPublicationDb();
  const bucket = createPublicationBucket();
  await publishModularStorefront(db, bucket, 'publish-request', 'faq');

  let status = await getModularPublishStatus(db, bucket);
  assert.equal(status.modules.find((module) => module.key === 'faq').isCurrent, true);

  const originalBody = db.state.faqs[0].answer;
  db.state.faqs[0].answer = `${originalBody}\nChanged content`;
  status = await getModularPublishStatus(db, bucket);
  assert.equal(status.modules.find((module) => module.key === 'faq').isCurrent, false);

  db.state.faqs[0].answer = originalBody;
  db.state.messageArticles[0].sort_order = 7;
  status = await getModularPublishStatus(db, bucket);
  assert.equal(status.modules.find((module) => module.key === 'faq').isCurrent, false);
});
