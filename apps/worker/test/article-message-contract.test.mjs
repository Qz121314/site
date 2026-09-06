import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Hono } from 'hono';
import {
  buildArticlePublicationFiles,
  buildArticlePublicationState,
  computePublishedStateRevision,
  deriveArticlePreview,
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
  let references = [
    { article_id: 'article-a', sort_order: 20, is_enabled: 1 },
    { article_id: 'article-b', sort_order: 10, is_enabled: 1 },
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
          throw new Error(`Unexpected all SQL: ${this.sql}`);
        },
      };
      return statement;
    },
    async batch(statements) {
      batches.push(statements.map((statement) => ({ sql: statement.sql, args: statement.args })));
      for (const statement of statements) {
        if (statement.sql === 'DELETE FROM message_article_references') {
          references = [];
          continue;
        }
        if (statement.sql.includes('INSERT INTO message_article_references')) {
          references.push({
            article_id: statement.args[0],
            sort_order: statement.args[1],
            is_enabled: 1,
          });
        }
      }
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    },
  };
}

function requestJson(app, method, body) {
  return app.request(
    'https://admin.example.com/',
    {
      method,
      headers: {
        'content-type': 'application/json',
        'x-admin-request': '1',
      },
      body: JSON.stringify(body),
    },
    { DB: body?.db },
  );
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
      { articleId: 'article-b', title: 'Article B', sortOrder: 10, enabled: true },
      { articleId: 'article-a', title: 'Article A', sortOrder: 20, enabled: true },
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
      { articleId: 'article-a', title: 'Article A', sortOrder: 0, enabled: true },
      { articleId: 'article-b', title: 'Article B', sortOrder: 1, enabled: true },
    ],
  });
  assert.deepEqual(
    db.references.map(({ article_id, sort_order }) => ({ article_id, sort_order })),
    [
      { article_id: 'article-a', sort_order: 0 },
      { article_id: 'article-b', sort_order: 1 },
    ],
  );
  const audit = db.batches.at(-1).find((statement) =>
    statement.sql.includes('INSERT INTO audit_logs'),
  );
  assert.ok(audit);
  assert.ok(audit.args.includes('messages.articles_updated'));
  assert.ok(audit.args.includes('message_article_reference'));
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

const publicationArticles = [
  {
    id: 'article-a',
    question: 'Enabled article',
    answer: '# Hello **world**\n\nSee [well-being guide](https://example.com).',
    sort_order: 10,
    is_enabled: 1,
  },
  {
    id: 'article-b',
    question: 'Generic-only article',
    answer: 'Full generic body',
    sort_order: 20,
    is_enabled: 0,
  },
];
const publicationMessages = [
  {
    article_id: 'article-b',
    question: 'Generic-only article',
    answer: 'Full generic body',
    sort_order: 0,
  },
];

test('article publication keeps legacy FAQ behavior while publishing generic articles and lightweight Messages metadata', () => {
  const state = buildArticlePublicationState(publicationArticles, publicationMessages);
  assert.deepEqual(
    state.faqs.map((article) => article.id),
    ['article-a'],
  );
  assert.deepEqual(
    state.articles.map((article) => article.id),
    ['article-a', 'article-b'],
  );
  assert.deepEqual(state.messageArticles, [
    {
      articleId: 'article-b',
      title: 'Generic-only article',
      preview: 'Full generic body',
      sortOrder: 0,
    },
  ]);
  assert.equal('body' in state.messageArticles[0], false);

  const files = buildArticlePublicationFiles(
    publicationArticles,
    publicationMessages,
    'article-content-version',
    NOW,
  );
  assert.deepEqual(
    files.map((file) => file.relativePath),
    ['faq.json', 'articles.json', 'messages.json'],
  );
  const faq = files.find((file) => file.relativePath === 'faq.json').value;
  const articles = files.find((file) => file.relativePath === 'articles.json').value;
  const messages = files.find((file) => file.relativePath === 'messages.json').value;
  assert.deepEqual(faq.faqs.map((article) => article.id), ['article-a']);
  assert.deepEqual(articles.articles.map((article) => article.id), [
    'article-a',
    'article-b',
  ]);
  assert.deepEqual(messages.articles, state.messageArticles);
  assert.equal(JSON.stringify(messages).includes('Full generic body'), true);
  assert.equal(JSON.stringify(messages).includes('Full generic body"'), true);
  assert.equal(messages.articles.some((article) => 'body' in article), false);
});

test('Markdown preview removes presentation syntax without corrupting ordinary hyphens', () => {
  assert.equal(
    deriveArticlePreview(
      '# Welcome\n\nRead the [well-being guide](https://example.com) and **stay-ready**.\n\n```js\nsecret()\n```',
    ),
    'Welcome Read the well-being guide and stay-ready.',
  );
});

test('article body changes and Messages placement changes both change the faq module source revision', async () => {
  const baseState = buildArticlePublicationState(publicationArticles, publicationMessages);
  const contentState = buildArticlePublicationState(
    publicationArticles.map((article) =>
      article.id === 'article-a' ? { ...article, answer: `${article.answer}\nChanged` } : article,
    ),
    publicationMessages,
  );
  const placementState = buildArticlePublicationState(publicationArticles, [
    { ...publicationMessages[0], sort_order: 8 },
  ]);

  const baseRevision = await computePublishedStateRevision(baseState);
  assert.notEqual(await computePublishedStateRevision(contentState), baseRevision);
  assert.notEqual(await computePublishedStateRevision(placementState), baseRevision);
});
