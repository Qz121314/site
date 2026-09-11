import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Hono } from 'hono';
import { adminMessageArticleRoutes } from '../src/routes/admin-message-articles.ts';

function withRequestId(routes) {
  const app = new Hono();
  app.use('*', async (context, next) => {
    context.set('requestId', 'message-cta-test-request');
    await next();
  });
  app.route('/', routes);
  return app;
}

function createDb() {
  const cards = [
    {
      id: 'card-b',
      title: 'B',
      background_media_id: null,
      target_kind: 'link',
      target_ref: 'https://example.com/b',
      target_label: 'https://example.com/b',
      section_id: null,
      conversion_group_id: null,
      sort_order: 1,
      is_enabled: 1,
    },
    {
      id: 'card-a',
      title: 'A',
      background_media_id: null,
      target_kind: 'article',
      target_ref: 'article-a',
      target_label: 'Article A',
      section_id: null,
      conversion_group_id: null,
      sort_order: 0,
      is_enabled: 1,
    },
  ];
  const articles = new Set(['article-a']);
  const prepared = [];
  return {
    cards,
    prepared,
    prepare(sql) {
      const statement = {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          if (this.sql.includes('SELECT id FROM faqs')) {
            return articles.has(this.args[0]) ? { id: this.args[0] } : null;
          }
          return null;
        },
        async all() {
          if (this.sql.includes('FROM message_cta_cards')) {
            return {
              results: [...cards].sort(
                (left, right) => left.sort_order - right.sort_order,
              ),
            };
          }
          if (this.sql.includes('FROM media_assets')) {
            return { results: this.args.map((id) => ({ id })) };
          }
          if (this.sql.includes('FROM faqs')) {
            return { results: [{ id: 'article-a', title: 'Article A' }] };
          }
          if (this.sql.includes('FROM conversion_groups')) return { results: [] };
          throw new Error(`Unexpected all SQL: ${this.sql}`);
        },
      };
      prepared.push(statement);
      return statement;
    },
    async batch(statements) {
      prepared.push(...statements);
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    },
  };
}

const app = withRequestId(adminMessageArticleRoutes);

test('historical article reference migration remains immutable while runtime owns generic cards', () => {
  const migration = readFileSync(
    new URL('../../../migrations/0031_message_article_references.sql', import.meta.url),
    'utf8',
  );
  const source = readFileSync(
    new URL('../src/routes/admin-message-articles.ts', import.meta.url),
    'utf8',
  );
  assert.match(migration, /CREATE TABLE message_article_references/u);
  assert.match(source, /message_cta_cards/u);
  assert.doesNotMatch(source, /message_article_references/u);
  assert.doesNotMatch(source, /articleIds/u);
});

test('GET returns generic CTA cards in deterministic order', async () => {
  const db = createDb();
  const response = await app.request('https://admin.example.com/', {}, { DB: db });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(
    body.cards.map(({ id }) => id),
    ['card-a', 'card-b'],
  );
  assert.equal(body.cards[0].targetKind, 'article');
  assert.equal(body.cards[1].targetRef, 'https://example.com/b');
});

test('PUT accepts article and link CTA targets with optional conversion binding', async () => {
  const db = createDb();
  const payload = {
    cards: [
      {
        id: 'card-article',
        title: 'Read',
        backgroundMediaId: null,
        targetKind: 'article',
        targetRef: 'article-a',
        sectionId: null,
        conversionGroupId: null,
      },
      {
        id: 'card-link',
        title: 'Visit',
        backgroundMediaId: null,
        targetKind: 'link',
        targetRef: 'https://example.com',
        sectionId: null,
        conversionGroupId: null,
      },
    ],
  };
  const response = await app.request(
    'https://admin.example.com/',
    {
      method: 'PUT',
      headers: { 'x-admin-request': '1', 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
    { DB: db },
  );
  assert.equal(response.status, 200);
  assert.equal(
    db.prepared.some((statement) =>
      statement.sql.includes('DELETE FROM message_cta_cards'),
    ),
    true,
  );
});
