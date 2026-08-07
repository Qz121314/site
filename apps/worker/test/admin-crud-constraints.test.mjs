import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { adminCategoryRoutes } from '../src/routes/admin-categories.ts';
import { adminConversionPoolRoutes } from '../src/routes/admin-conversion-pool.ts';
import { adminCustomerServiceRoutes } from '../src/routes/admin-customer-service.ts';
import { adminFaqRoutes } from '../src/routes/admin-faqs.ts';
import { adminTagRoutes } from '../src/routes/admin-tags.ts';
import {
  createProduct,
  createUpdateProductStatements,
  validateProductDependencies,
  validateProductInput,
} from '../src/products/products.ts';
import {
  createReplaceProductTagStatements,
  parseProductTagIds,
  validateProductTagBindings,
} from '../src/products/product-tags.ts';
import { PublicationError, publishSnapshot } from '../src/publishing/snapshot-publisher.ts';

const NOW = '2026-08-07T00:00:00.000Z';

function withRequestId(routes) {
  const app = new Hono();
  app.use('*', async (context, next) => {
    context.set('requestId', 'test-request-id');
    await next();
  });
  app.route('/', routes);
  return app;
}

function blockingDb(match, row) {
  let batchCalls = 0;
  return {
    get batchCalls() {
      return batchCalls;
    },
    prepare(sql) {
      return {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          if (this.sql.includes(match)) return row;
          throw new Error(`Unexpected first SQL: ${this.sql}`);
        },
      };
    },
    async batch() {
      batchCalls += 1;
      return [];
    },
  };
}

function categoryRow(productCount = 0) {
  return {
    id: 'category-1',
    section_id: 'section-1',
    name: 'Primary',
    sort_order: 0,
    is_enabled: 1,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    product_count: productCount,
  };
}

function tagRow(productCount = 0) {
  return {
    id: 'tag-1',
    section_id: 'section-1',
    name: 'Verified',
    sort_order: 0,
    is_enabled: 1,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    product_count: productCount,
  };
}

function conversionGroupRow({ mode = 'link', targetCount = 0, activeTargetCount = targetCount, productCount = 0, enabled = true } = {}) {
  return {
    id: 'group-1',
    section_id: 'section-1',
    name: 'Primary conversion',
    mode,
    button_label: 'Contact',
    rotation_strategy: 'round_robin',
    sort_order: 0,
    is_enabled: enabled ? 1 : 0,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    target_count: targetCount,
    active_target_count: activeTargetCount,
    product_count: productCount,
  };
}

function connectionRow(targetCount = 0) {
  return {
    id: 'connection-1',
    name: 'Support A',
    provider: 'generic_v1',
    base_url: 'https://support.example',
    project_id: 'project-1',
    api_token: 'private-token',
    private_config_json: null,
    is_enabled: 1,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    target_count: targetCount,
  };
}

function recordingDb() {
  const statements = [];
  return {
    statements,
    prepare(sql) {
      const statement = {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
      };
      statements.push(statement);
      return statement;
    },
  };
}

function baseProductInput(overrides = {}) {
  return {
    serviceMode: 'online',
    title: ' Product One ',
    body: ' Body ',
    address: 'ignored for online',
    categoryId: 'category-1',
    conversionGroupId: 'group-1',
    coverAssetId: null,
    mediaAssetIds: ['media-1', 'media-2'],
    isFeatured: false,
    featuredOrder: 0,
    sortOrder: 10,
    status: 'published',
    ...overrides,
  };
}

function productDependencyDb({
  category = categoryRow(),
  group = conversionGroupRow({ targetCount: 1, activeTargetCount: 1 }),
  mediaIds = ['media-1', 'media-2'],
} = {}) {
  return {
    prepare(sql) {
      return {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          if (this.sql.includes('FROM categories c')) return category;
          if (this.sql.includes('FROM conversion_groups g')) return group;
          throw new Error(`Unexpected first SQL: ${this.sql}`);
        },
        async all() {
          if (this.sql.includes('SELECT id FROM media_assets')) {
            return { results: mediaIds.map((id) => ({ id })) };
          }
          throw new Error(`Unexpected all SQL: ${this.sql}`);
        },
      };
    },
  };
}

function productTagDb(rows) {
  return {
    prepare(sql) {
      return {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async all() {
          if (this.sql.includes('FROM product_tags_catalog')) return { results: rows };
          throw new Error(`Unexpected all SQL: ${this.sql}`);
        },
      };
    },
  };
}

function faqDb() {
  const records = new Map([
    ['faq-1', { id: 'faq-1', question: 'Q1', answer: 'A1', sort_order: 10, is_enabled: 1, created_at: NOW, updated_at: NOW, deleted_at: null }],
    ['faq-2', { id: 'faq-2', question: 'Q2', answer: 'A2', sort_order: 20, is_enabled: 1, created_at: NOW, updated_at: NOW, deleted_at: null }],
  ]);
  const idempotency = new Map();
  let batchCalls = 0;
  const executedBatchSql = [];

  return {
    records,
    get batchCalls() {
      return batchCalls;
    },
    get executedBatchSql() {
      return executedBatchSql;
    },
    prepare(sql) {
      return {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async run() {
          if (this.sql.includes('DELETE FROM idempotency_keys')) {
            return { success: true, meta: { changes: 0 } };
          }
          throw new Error(`Unexpected run SQL: ${this.sql}`);
        },
        async first() {
          if (this.sql.includes('SELECT response_body') && this.sql.includes('FROM idempotency_keys')) {
            const responseBody = idempotency.get(this.args[0]);
            return responseBody ? { response_body: responseBody } : null;
          }
          if (this.sql.includes('FROM faqs')) {
            return records.get(this.args[0]) ?? null;
          }
          throw new Error(`Unexpected first SQL: ${this.sql}`);
        },
      };
    },
    async batch(statements) {
      batchCalls += 1;
      for (const statement of statements) {
        executedBatchSql.push(statement.sql);
        if (statement.sql.includes('UPDATE faqs') && statement.sql.includes('SET is_enabled = 0')) {
          const id = statement.args[2];
          const current = records.get(id);
          if (current) {
            records.set(id, { ...current, is_enabled: 0, deleted_at: statement.args[0], updated_at: statement.args[1] });
          }
        }
        if (statement.sql.includes('UPDATE faqs') && statement.sql.includes('SET deleted_at = NULL')) {
          const id = statement.args[1];
          const current = records.get(id);
          if (current) records.set(id, { ...current, deleted_at: null, updated_at: statement.args[0] });
        }
        if (statement.sql.includes('INSERT INTO idempotency_keys')) {
          idempotency.set(statement.args[0], statement.args[3]);
        }
      }
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    },
  };
}

function readinessDb({ mediaBaseUrl = 'https://media.example', products = [], productMedia = [] } = {}) {
  return {
    prepare(sql) {
      return {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          if (this.sql.includes("WHERE status IN ('queued', 'building')")) return null;
          if (this.sql.includes('FROM site_settings ss')) {
            return {
              site_name: 'Example',
              location_label: 'City',
              media_base_url: mediaBaseUrl,
              logo_asset_id: null,
              logo_object_key: null,
              home_section_limit: 10,
              show_hot: 1,
              show_latest: 1,
              show_more: 1,
              show_messages: 1,
              show_faq: 1,
              ga4_measurement_id: null,
              facebook_pixel_id: null,
              affiliate_detection_enabled: 0,
              affiliate_platform: null,
              affiliate_detection_config_json: null,
              updated_at: NOW,
            };
          }
          if (this.sql.includes('FROM customer_service_settings')) return null;
          throw new Error(`Unexpected first SQL: ${this.sql}`);
        },
        async all() {
          if (this.sql.includes('FROM sections s') && !this.sql.includes('FROM products p')) {
            return {
              results: [{ id: 'section-1', slug: 'main', name: 'Main', icon_type: 'icon', icon_value: 'grid', icon_asset_id: null, icon_object_key: null, sort_order: 0, updated_at: NOW }],
            };
          }
          if (this.sql.includes('FROM categories c')) {
            return { results: [{ id: 'category-1', section_id: 'section-1', name: 'Primary', sort_order: 0, updated_at: NOW }] };
          }
          if (this.sql.includes('FROM products p')) return { results: products };
          if (this.sql.includes('FROM product_media pm')) return { results: productMedia };
          if (this.sql.includes('FROM faqs')) return { results: [] };
          throw new Error(`Unexpected all SQL: ${this.sql}`);
        },
      };
    },
  };
}

function publishedSnapshotProduct(overrides = {}) {
  return {
    id: 'product-1',
    section_id: 'section-1',
    section_slug: 'main',
    section_name: 'Main',
    slug: 'product-1',
    service_mode: 'online',
    title: 'Product One',
    body: 'Body',
    address: null,
    category_id: 'category-1',
    category_name: 'Primary',
    category_enabled: 1,
    conversion_group_id: 'group-1',
    conversion_group_name: 'Primary conversion',
    conversion_mode: 'link',
    button_label: 'Contact',
    conversion_group_enabled: 1,
    active_target_count: 1,
    effective_cover_object_key: 'media/product-1.webp',
    is_featured: 0,
    featured_order: 0,
    sort_order: 0,
    published_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

test('category deletion is blocked when products still reference the category', async () => {
  const db = blockingDb('FROM categories c', categoryRow(2));
  const app = withRequestId(adminCategoryRoutes);
  const response = await app.request(
    'http://local.test/section-1/categories/category-1',
    { method: 'DELETE', headers: { 'x-admin-request': '1' } },
    { DB: db },
  );
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.error.code, 'CATEGORY_HAS_PRODUCTS');
  assert.equal(body.error.details.productCount, 2);
  assert.equal(db.batchCalls, 0);
});

test('tag deletion is blocked while an active product references the tag', async () => {
  const db = blockingDb('FROM product_tags_catalog t', tagRow(3));
  const app = withRequestId(adminTagRoutes);
  const response = await app.request(
    'http://local.test/section-1/tags/tag-1',
    { method: 'DELETE', headers: { 'x-admin-request': '1' } },
    { DB: db },
  );
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.error.code, 'PRODUCT_TAG_HAS_PRODUCTS');
  assert.equal(body.error.details.productCount, 3);
  assert.equal(db.batchCalls, 0);
});

test('customer-service connection deletion is blocked while conversion targets use it', async () => {
  const db = blockingDb('FROM customer_service_connections c', connectionRow(2));
  const app = withRequestId(adminCustomerServiceRoutes);
  const response = await app.request(
    'http://local.test/connections/connection-1',
    { method: 'DELETE', headers: { 'x-admin-request': '1' } },
    { DB: db },
  );
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.error.code, 'CUSTOMER_SERVICE_CONNECTION_IN_USE');
  assert.equal(body.error.details.targetCount, 2);
  assert.equal(db.batchCalls, 0);
});

test('conversion-group deletion is blocked while targets or products still depend on it', async () => {
  const db = blockingDb('FROM conversion_groups g', conversionGroupRow({ targetCount: 1, productCount: 4 }));
  const app = withRequestId(adminConversionPoolRoutes);
  const response = await app.request(
    'http://local.test/section-1/conversion-groups/group-1',
    { method: 'DELETE', headers: { 'x-admin-request': '1' } },
    { DB: db },
  );
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.error.code, 'CONVERSION_GROUP_HAS_DEPENDENCIES');
  assert.equal(body.error.details.targetCount, 1);
  assert.equal(body.error.details.productCount, 4);
  assert.equal(db.batchCalls, 0);
});

test('FAQ batch delete is idempotent and deleted FAQs can be restored', async () => {
  const db = faqDb();
  const app = withRequestId(adminFaqRoutes);
  const request = () =>
    app.request(
      'http://local.test/batch-delete',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-request': '1',
          'x-idempotency-key': 'faq-delete-1',
        },
        body: JSON.stringify({ ids: ['faq-1', 'faq-2'] }),
      },
      { DB: db },
    );

  const first = await request();
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { deletedIds: ['faq-1', 'faq-2'] });
  assert.equal(db.batchCalls, 1);
  assert.equal(db.executedBatchSql.filter((sql) => sql.includes('SET is_enabled = 0')).length, 2);

  const replay = await request();
  assert.equal(replay.status, 200);
  assert.deepEqual(await replay.json(), { deletedIds: ['faq-1', 'faq-2'] });
  assert.equal(db.batchCalls, 1, 'idempotent replay must not execute another delete batch');

  const restore = await app.request(
    'http://local.test/faq-1/restore',
    { method: 'POST', headers: { 'x-admin-request': '1' } },
    { DB: db },
  );
  assert.equal(restore.status, 200);
  const restored = await restore.json();
  assert.equal(restored.faq.id, 'faq-1');
  assert.equal(restored.faq.deletedAt, null);
  assert.equal(db.batchCalls, 2);
});

test('product input normalizes online address and requires cover image to belong to product media', () => {
  const valid = validateProductInput(baseProductInput({ coverAssetId: 'media-2' }));
  assert.equal(valid.ok, true);
  if (!valid.ok) return;
  assert.equal(valid.value.title, 'Product One');
  assert.equal(valid.value.body, 'Body');
  assert.equal(valid.value.address, null);
  assert.equal(valid.value.coverAssetId, 'media-2');

  const invalid = validateProductInput(baseProductInput({ coverAssetId: 'other-media' }));
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.field, 'coverAssetId');
});

test('published product dependency validation accepts a ready link product and rejects mode mismatch', async () => {
  const parsed = validateProductInput(baseProductInput());
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const valid = await validateProductDependencies(productDependencyDb(), 'section-1', parsed.value);
  assert.deepEqual(valid, { ok: true });

  const mismatch = await validateProductDependencies(
    productDependencyDb({ group: conversionGroupRow({ mode: 'customer_service', targetCount: 1, activeTargetCount: 1 }) }),
    'section-1',
    parsed.value,
  );
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.code, 'CONVERSION_MODE_MISMATCH');
});

test('published products reject missing media and offline products require an address', async () => {
  const noMedia = validateProductInput(baseProductInput({ mediaAssetIds: [], coverAssetId: null }));
  assert.equal(noMedia.ok, true);
  if (!noMedia.ok) return;
  const missingMedia = await validateProductDependencies(productDependencyDb({ mediaIds: [] }), 'section-1', noMedia.value);
  assert.equal(missingMedia.ok, false);
  if (!missingMedia.ok) assert.equal(missingMedia.code, 'PRODUCT_IMAGE_REQUIRED');

  const offline = validateProductInput(
    baseProductInput({
      serviceMode: 'offline',
      address: '',
      conversionGroupId: 'group-1',
    }),
  );
  assert.equal(offline.ok, true);
  if (!offline.ok) return;
  const missingAddress = await validateProductDependencies(
    productDependencyDb({ group: conversionGroupRow({ mode: 'customer_service', targetCount: 1, activeTargetCount: 1 }) }),
    'section-1',
    offline.value,
  );
  assert.equal(missingAddress.ok, false);
  if (!missingAddress.ok) assert.equal(missingAddress.code, 'ADDRESS_REQUIRED');
});

test('product tag bindings enforce uniqueness, section ownership, enable state and the 12-tag cap', async () => {
  assert.equal(parseProductTagIds(['tag-1', 'tag-1']).ok, false);
  assert.equal(parseProductTagIds(Array.from({ length: 13 }, (_, index) => `tag-${index}`)).ok, false);

  const publishedDisabled = await validateProductTagBindings(
    productTagDb([{ id: 'tag-1', section_id: 'section-1', is_enabled: 0, deleted_at: null }]),
    'section-1',
    ['tag-1'],
    'published',
  );
  assert.equal(publishedDisabled.ok, false);
  if (!publishedDisabled.ok) assert.equal(publishedDisabled.code, 'PRODUCT_TAG_DISABLED');

  const draftDisabled = await validateProductTagBindings(
    productTagDb([{ id: 'tag-1', section_id: 'section-1', is_enabled: 0, deleted_at: null }]),
    'section-1',
    ['tag-1'],
    'draft',
  );
  assert.deepEqual(draftDisabled, { ok: true });

  const wrongSection = await validateProductTagBindings(
    productTagDb([{ id: 'tag-1', section_id: 'section-2', is_enabled: 1, deleted_at: null }]),
    'section-1',
    ['tag-1'],
    'draft',
  );
  assert.equal(wrongSection.ok, false);
  if (!wrongSection.ok) assert.equal(wrongSection.code, 'PRODUCT_TAG_INVALID');
});

test('product create/update media statements and tag replacement preserve deterministic ordering', () => {
  const db = recordingDb();
  const input = {
    serviceMode: 'online',
    title: 'Product One',
    body: 'Body',
    address: null,
    categoryId: 'category-1',
    conversionGroupId: 'group-1',
    coverAssetId: null,
    mediaAssetIds: ['media-1', 'media-2'],
    isFeatured: false,
    featuredOrder: 0,
    sortOrder: 10,
    status: 'published',
  };
  const created = createProduct(db, 'section-1', input, NOW);
  assert.equal(created.statements.length, 3);
  assert.equal(created.product.effectiveCoverAssetId, 'media-1');
  assert.equal(created.product.publishedAt, NOW);
  assert.deepEqual(created.statements.slice(1).map((statement) => statement.args[2]), [0, 10]);

  const tagStatements = createReplaceProductTagStatements(db, created.product.id, ['tag-a', 'tag-b'], NOW);
  assert.equal(tagStatements.length, 3);
  assert.ok(tagStatements[0].sql.includes('DELETE FROM product_tag_bindings'));
  assert.deepEqual(tagStatements.slice(1).map((statement) => statement.args[1]), ['tag-a', 'tag-b']);

  const updated = createUpdateProductStatements(db, created.product, { ...input, mediaAssetIds: ['media-2', 'media-1'] }, '2026-08-07T01:00:00.000Z');
  assert.equal(updated.length, 4);
  assert.ok(updated[1].sql.includes('DELETE FROM product_media'));
  assert.deepEqual(updated.slice(2).map((statement) => statement.args[1]), ['media-2', 'media-1']);
  assert.deepEqual(updated.slice(2).map((statement) => statement.args[2]), [0, 10]);
});

test('publish readiness rejects a missing R2 media domain before creating a snapshot', async () => {
  await assert.rejects(
    () => publishSnapshot(readinessDb({ mediaBaseUrl: null }), {}, 'request-1'),
    (error) => error instanceof PublicationError && error.code === 'MEDIA_DOMAIN_REQUIRED',
  );
});

test('publish readiness rejects a published product without an enabled conversion target', async () => {
  const product = publishedSnapshotProduct({ active_target_count: 0 });
  await assert.rejects(
    () => publishSnapshot(readinessDb({ products: [product], productMedia: [{ product_id: 'product-1', id: 'media-1', object_key: 'media/product-1.webp', file_name: 'product.webp', mime_type: 'image/webp', width: 800, height: 800, sort_order: 0, alt_text: 'Product One' }] }), {}, 'request-2'),
    (error) => error instanceof PublicationError && error.code === 'PRODUCT_CONVERSION_INVALID',
  );
});
