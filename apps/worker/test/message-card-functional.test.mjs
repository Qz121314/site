import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { Hono } from 'hono';
import { publishModularStorefront } from '../src/publishing/storefront-publisher.ts';
import { adminConversionPoolRoutes } from '../src/routes/admin-conversion-pool.ts';
import { adminFaqRoutes } from '../src/routes/admin-faqs.ts';
import { adminMessageArticleRoutes } from '../src/routes/admin-message-articles.ts';
import { publicConversionRoutes } from '../src/routes/public-conversion.ts';
import { publicStorefrontConfigRoutes } from '../src/routes/public-storefront-config.ts';

const NOW = '2026-10-15T12:00:00.000Z';

function seed(sqlite, script) {
  for (const statement of script
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean)) {
    try {
      sqlite.exec(statement);
    } catch (error) {
      throw new Error(`Failed fixture statement: ${statement}`, { cause: error });
    }
  }
}

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  for (const name of readdirSync(new URL('../../../migrations/', import.meta.url))
    .filter((file) => file.endsWith('.sql'))
    .sort()) {
    sqlite.exec(
      readFileSync(new URL(`../../../migrations/${name}`, import.meta.url), 'utf8'),
    );
  }
  const db = {
    prepare(sql) {
      let args = [];
      const statement = {
        bind(...values) {
          args = values;
          return statement;
        },
        async first() {
          return sqlite.prepare(sql).get(...args) ?? null;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...args) };
        },
        async run() {
          const result = sqlite.prepare(sql).run(...args);
          return { success: true, meta: { changes: result.changes } };
        },
      };
      return statement;
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const objects = new Map();
  const bucket = {
    async put(key, body) {
      objects.set(key, String(body));
    },
    async get(key) {
      const body = objects.get(key);
      return body === undefined ? null : { text: async () => body };
    },
    async head(key) {
      return objects.has(key) ? { key } : null;
    },
    async list({ prefix = '' }) {
      return {
        objects: [...objects.keys()]
          .filter((key) => key.startsWith(prefix))
          .map((key) => ({ key, uploaded: new Date(NOW) })),
        truncated: false,
      };
    },
    async delete(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
    },
  };
  const routes = new Hono();
  routes.use('*', async (context, next) => {
    context.set('requestId', 'message-card-test');
    await next();
  });
  routes.route('/go', publicConversionRoutes);
  routes.route('/api/public/storefront', publicStorefrontConfigRoutes);
  routes.route('/admin/groups', adminConversionPoolRoutes);
  routes.route('/admin/articles', adminFaqRoutes);
  routes.route('/admin/message-articles', adminMessageArticleRoutes);
  const env = { DB: db, ASSETS_BUCKET: bucket };
  return { sqlite, db, objects, bucket, routes, env, close: () => sqlite.close() };
}

test('message card handoff uses its selected group instead of the section default', async () => {
  const f = fixture();
  try {
    seed(
      f.sqlite,
      `
      INSERT INTO sections (id, slug, name, icon_type, icon_value, created_at, updated_at)
      VALUES ('owner', 'owner', 'Owner', 'icon', 'star', '${NOW}', '${NOW}'),
             ('shared', 'shared', 'Shared', 'icon', 'star', '${NOW}', '${NOW}');
      INSERT INTO customer_service_connections
        (id, name, provider, base_url, client_api_url, realtime_url, verified_at, created_at, updated_at)
      VALUES ('connection-a', 'A', 'generic_v1', 'https://a.example', 'https://a.example/client/v1', 'wss://a.example/realtime', '${NOW}', '${NOW}', '${NOW}'),
             ('connection-b', 'B', 'generic_v1', 'https://b.example', 'https://b.example/client/v1', 'wss://b.example/realtime', '${NOW}', '${NOW}', '${NOW}');
      INSERT INTO conversion_groups
        (id, section_id, name, mode, button_label, customer_service_connection_id, created_at, updated_at)
      VALUES ('group-a', 'shared', 'A', 'customer_service', 'Contact A', 'connection-a', '${NOW}', '${NOW}'),
             ('group-b', 'shared', 'B', 'customer_service', 'Contact B', 'connection-b', '${NOW}', '${NOW}');
      INSERT INTO conversion_group_sections (group_id, section_id, created_at)
      VALUES ('group-a', 'shared', '${NOW}'),
             ('group-b', 'shared', '${NOW}');
      UPDATE sections SET conversion_group_id = 'group-b' WHERE id = 'shared';
      INSERT INTO message_cta_cards
        (id, title, target_kind, target_ref, section_id, conversion_group_id, created_at, updated_at)
      VALUES ('card-a', 'Contact A', 'link', 'https://example.com', 'shared', 'group-a', '${NOW}', '${NOW}');
    `,
    );
    const redirect = await f.routes.request(
      'https://site.example/go/message-card/card-a',
      { headers: { accept: 'application/json' } },
      f.env,
    );
    assert.equal(redirect.status, 200);
    const path = (await redirect.json()).path;
    const target = new URL(path, 'https://site.example');
    assert.equal(target.pathname, '/messages/new/');
    assert.equal(target.searchParams.get('sectionId'), 'shared');
    assert.equal(target.searchParams.get('cardId'), 'card-a');
    assert.match(target.searchParams.get('handoffId'), /^[0-9a-f]{8}-/u);

    const cardRoute = await f.routes.request(
      'https://site.example/api/public/storefront/support/route/section/shared?cardId=card-a',
      {},
      f.env,
    );
    assert.equal(cardRoute.status, 200);
    assert.equal((await cardRoute.json()).connection.id, 'connection-a');
    const sectionRoute = await f.routes.request(
      'https://site.example/api/public/storefront/support/route/section/shared',
      {},
      f.env,
    );
    assert.equal((await sectionRoute.json()).connection.id, 'connection-b');
    f.sqlite.exec(
      "UPDATE customer_service_connections SET verified_at = NULL WHERE id = 'connection-a'",
    );
    const unverified = await f.routes.request(
      'https://site.example/api/public/storefront/support/route/section/shared?cardId=card-a',
      {},
      f.env,
    );
    assert.equal((await unverified.json()).available, false);
    f.sqlite.exec("UPDATE conversion_groups SET is_enabled = 0 WHERE id = 'group-a'");
    const unavailable = await f.routes.request(
      'https://site.example/go/message-card/card-a',
      { headers: { accept: 'application/json' } },
      f.env,
    );
    assert.equal(unavailable.status, 409);
  } finally {
    f.close();
  }
});

test('article and conversion group deletion block cards that actually use them', async () => {
  const f = fixture();
  try {
    f.sqlite.exec(`
      INSERT INTO sections (id, slug, name, icon_type, icon_value, created_at, updated_at)
      VALUES ('section-a', 'section-a', 'Section A', 'icon', 'star', '${NOW}', '${NOW}');
      INSERT INTO customer_service_connections
        (id, name, provider, base_url, client_api_url, realtime_url, verified_at, created_at, updated_at)
      VALUES ('connection-a', 'A', 'generic_v1', 'https://a.example', 'https://a.example/client/v1', 'wss://a.example/realtime', '${NOW}', '${NOW}', '${NOW}');
      INSERT INTO conversion_groups
        (id, section_id, name, mode, button_label, customer_service_connection_id, created_at, updated_at)
      VALUES ('group-a', 'section-a', 'A', 'customer_service', 'Contact', 'connection-a', '${NOW}', '${NOW}');
      INSERT INTO conversion_group_sections (group_id, section_id, created_at)
      VALUES ('group-a', 'section-a', '${NOW}');
      INSERT INTO faqs (id, question, answer, sort_order, is_enabled, created_at, updated_at)
      VALUES ('article-a', 'Article', 'Body', 0, 1, '${NOW}', '${NOW}');
      INSERT INTO message_cta_cards
        (id, title, target_kind, target_ref, section_id, conversion_group_id, created_at, updated_at)
      VALUES ('card-group', 'Contact', 'article', 'article-a', 'section-a', 'group-a', '${NOW}', '${NOW}'),
             ('card-article', 'Read', 'article', 'article-a', NULL, NULL, '${NOW}', '${NOW}');
    `);
    const headers = { 'x-admin-request': '1' };
    const groupDelete = await f.routes.request(
      'https://site.example/admin/groups/section-a/conversion-groups/group-a',
      { method: 'DELETE', headers },
      f.env,
    );
    assert.equal(groupDelete.status, 409);
    assert.equal((await groupDelete.json()).error.details.cardCount, 1);
    const groupBatchDelete = await f.routes.request(
      'https://site.example/admin/groups/section-a/conversion-groups/batch-delete',
      {
        method: 'POST',
        headers: {
          ...headers,
          'content-type': 'application/json',
          'x-idempotency-key': 'group-batch',
        },
        body: JSON.stringify({ ids: ['group-a'] }),
      },
      f.env,
    );
    assert.equal(groupBatchDelete.status, 409);
    const articleDelete = await f.routes.request(
      'https://site.example/admin/articles/article-a',
      { method: 'DELETE', headers },
      f.env,
    );
    assert.equal(articleDelete.status, 409);
    assert.equal((await articleDelete.json()).error.details.cardCount, 1);
    const articleBatchDelete = await f.routes.request(
      'https://site.example/admin/articles/batch-delete',
      {
        method: 'POST',
        headers: {
          ...headers,
          'content-type': 'application/json',
          'x-idempotency-key': 'article-batch',
        },
        body: JSON.stringify({ ids: ['article-a'] }),
      },
      f.env,
    );
    assert.equal(articleBatchDelete.status, 409);
    f.sqlite.exec("DELETE FROM message_cta_cards WHERE id = 'card-article'");
    const unusedArticleDelete = await f.routes.request(
      'https://site.example/admin/articles/article-a',
      { method: 'DELETE', headers },
      f.env,
    );
    assert.equal(unusedArticleDelete.status, 200);
    const effectiveGroupSave = await f.routes.request(
      'https://site.example/admin/message-articles',
      {
        method: 'PUT',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({
          cards: [
            {
              id: 'card-group',
              title: 'Contact',
              backgroundMediaId: null,
              targetKind: 'article',
              targetRef: 'article-a',
              sectionId: 'section-a',
              conversionGroupId: 'group-a',
            },
          ],
        }),
      },
      f.env,
    );
    assert.equal(effectiveGroupSave.status, 200);
  } finally {
    f.close();
  }
});

test('publisher retains shared group labels and omits already dangling article cards', async () => {
  const f = fixture();
  try {
    f.sqlite.exec(`
      UPDATE site_settings SET media_base_url = 'https://media.example';
      INSERT INTO sections (id, slug, name, icon_type, icon_value, created_at, updated_at)
      VALUES ('owner', 'owner', 'Owner', 'icon', 'star', '${NOW}', '${NOW}'),
             ('shared', 'shared', 'Shared', 'icon', 'star', '${NOW}', '${NOW}');
      INSERT INTO conversion_groups (id, section_id, name, mode, button_label, created_at, updated_at)
      VALUES ('group-a', 'owner', 'Shared Group', 'link', 'Shared Label', '${NOW}', '${NOW}'),
             ('group-disabled', 'owner', 'Disabled', 'link', 'Hidden', '${NOW}', '${NOW}');
      UPDATE conversion_groups SET is_enabled = 0 WHERE id = 'group-disabled';
      INSERT INTO conversion_group_sections (group_id, section_id, created_at)
      VALUES ('group-a', 'owner', '${NOW}'), ('group-a', 'shared', '${NOW}');
      INSERT INTO conversion_targets (id, section_id, group_id, name, endpoint_url, created_at, updated_at)
      VALUES ('target-a', 'owner', 'group-a', 'Target', 'https://target.example', '${NOW}', '${NOW}');
      UPDATE sections SET conversion_group_id = 'group-a' WHERE id = 'shared';
      INSERT INTO products
        (id, section_id, slug, service_mode, title, body, conversion_group_id, status, published_at, created_at, updated_at)
      VALUES ('product-a', 'shared', 'product-a', 'online', 'Product', 'Body', 'group-a', 'published', '${NOW}', '${NOW}', '${NOW}');
      INSERT INTO faqs (id, question, answer, sort_order, is_enabled, created_at, updated_at)
      VALUES ('deleted-article', 'Deleted', 'Body', 0, 0, '${NOW}', '${NOW}'),
             ('disabled-article', 'Disabled', 'Body', 1, 0, '${NOW}', '${NOW}');
      UPDATE faqs SET deleted_at = '${NOW}' WHERE id = 'deleted-article';
      INSERT INTO message_cta_cards (id, title, target_kind, target_ref, created_at, updated_at)
      VALUES ('dangling-card', 'Dangling', 'article', 'deleted-article', '${NOW}', '${NOW}'),
             ('disabled-article-card', 'Disabled', 'article', 'disabled-article', '${NOW}', '${NOW}');
      INSERT INTO message_cta_cards
        (id, title, target_kind, target_ref, section_id, conversion_group_id, created_at, updated_at)
      VALUES ('disabled-group-card', 'Disabled group', 'link', 'https://example.com', 'owner', 'group-disabled', '${NOW}', '${NOW}');
    `);
    await publishModularStorefront(f.db, f.bucket, 'message-card-test');
    const pointer = JSON.parse(f.objects.get('public/current.json'));
    const section = JSON.parse(
      f.objects.get(
        pointer.sections.shared.manifestKey.replace('manifest.json', 'section.json'),
      ),
    );
    const index = JSON.parse(
      f.objects.get(
        pointer.sectionsIndex.manifestKey.replace('manifest.json', 'sections.json'),
      ),
    );
    const messages = JSON.parse(
      f.objects.get(pointer.faq.manifestKey.replace('manifest.json', 'messages.json')),
    );
    assert.equal(section.products[0].conversionButtonLabel, 'Shared Label');
    assert.equal(
      index.sections.find((item) => item.id === 'shared').conversionButtonLabel,
      'Shared Label',
    );
    assert.deepEqual(messages.articles, []);
  } finally {
    f.close();
  }
});
