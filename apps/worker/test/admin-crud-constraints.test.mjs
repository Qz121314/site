import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { Hono } from 'hono';
import { adminCategoryRoutes } from '../src/routes/admin-categories.ts';
import { adminConversionPoolRoutes } from '../src/routes/admin-conversion-pool.ts';
import { adminCustomerServiceRoutes } from '../src/routes/admin-customer-service.ts';
import { adminFaqRoutes } from '../src/routes/admin-faqs.ts';
import { adminTagRoutes } from '../src/routes/admin-tags.ts';
import {
  createPermanentDeleteProductStatements,
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

function categoryReferenceDb(productSectionId, productDeletedAt = null) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE categories (
      id TEXT PRIMARY KEY, section_id TEXT, name TEXT, sort_order INTEGER,
      is_enabled INTEGER, created_at TEXT, updated_at TEXT, deleted_at TEXT
    );
    CREATE TABLE products (
      id TEXT PRIMARY KEY, section_id TEXT, category_id TEXT, deleted_at TEXT
    );
    INSERT INTO categories VALUES (
      'category-1', 'section-1', 'Primary', 0, 1, '${NOW}', '${NOW}', NULL
    );
    INSERT INTO products VALUES (
      'product-1', '${productSectionId}', 'category-1',
      ${productDeletedAt ? `'${productDeletedAt}'` : 'NULL'}
    );
  `);

  return {
    prepare(sql) {
      const statement = {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          return sqlite.prepare(sql).get(...this.args) ?? null;
        },
      };
      return statement;
    },
    async batch(statements) {
      for (const statement of statements) {
        if (statement.sql.startsWith('UPDATE categories')) {
          sqlite.prepare(statement.sql).run(...statement.args);
        }
      }
    },
    deletedAt() {
      return sqlite
        .prepare('SELECT deleted_at FROM categories WHERE id = ?')
        .get('category-1').deleted_at;
    },
    close() {
      sqlite.close();
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

function conversionGroupRow({
  mode = 'link',
  targetCount = 0,
  activeTargetCount = targetCount,
  productCount = 0,
  enabled = true,
} = {}) {
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
    [
      'faq-1',
      {
        id: 'faq-1',
        question: 'Q1',
        answer: 'A1',
        sort_order: 10,
        is_enabled: 1,
        created_at: NOW,
        updated_at: NOW,
        deleted_at: null,
      },
    ],
    [
      'faq-2',
      {
        id: 'faq-2',
        question: 'Q2',
        answer: 'A2',
        sort_order: 20,
        is_enabled: 1,
        created_at: NOW,
        updated_at: NOW,
        deleted_at: null,
      },
    ],
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
          if (
            this.sql.includes('SELECT response_body') &&
            this.sql.includes('FROM idempotency_keys')
          ) {
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
        if (
          statement.sql.includes('UPDATE faqs') &&
          statement.sql.includes('SET is_enabled = 0')
        ) {
          const id = statement.args[2];
          const current = records.get(id);
          if (current) {
            records.set(id, {
              ...current,
              is_enabled: 0,
              deleted_at: statement.args[0],
              updated_at: statement.args[1],
            });
          }
        }
        if (
          statement.sql.includes('UPDATE faqs') &&
          statement.sql.includes('SET deleted_at = NULL')
        ) {
          const id = statement.args[1];
          const current = records.get(id);
          if (current)
            records.set(id, {
              ...current,
              deleted_at: null,
              updated_at: statement.args[0],
            });
        }
        if (statement.sql.includes('INSERT INTO idempotency_keys')) {
          idempotency.set(statement.args[0], statement.args[3]);
        }
      }
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    },
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

test('category deletion ignores product references from another section', async () => {
  const db = categoryReferenceDb('section-2');
  const app = withRequestId(adminCategoryRoutes);
  const response = await app.request(
    'http://local.test/section-1/categories/category-1',
    { method: 'DELETE', headers: { 'x-admin-request': '1' } },
    { DB: db },
  );

  assert.equal(response.status, 200);
  assert.ok(db.deletedAt());
  db.close();
});

test('category deletion remains blocked by same-section products in the recycle bin', async () => {
  const db = categoryReferenceDb('section-1', NOW);
  const app = withRequestId(adminCategoryRoutes);
  const response = await app.request(
    'http://local.test/section-1/categories/category-1',
    { method: 'DELETE', headers: { 'x-admin-request': '1' } },
    { DB: db },
  );

  assert.equal(response.status, 409);
  assert.equal(db.deletedAt(), null);
  db.close();
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
  const db = blockingDb(
    'FROM conversion_groups g',
    conversionGroupRow({ targetCount: 1, productCount: 4 }),
  );
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
  assert.equal(
    db.executedBatchSql.filter((sql) => sql.includes('SET is_enabled = 0')).length,
    2,
  );

  const replay = await request();
  assert.equal(replay.status, 200);
  assert.deepEqual(await replay.json(), { deletedIds: ['faq-1', 'faq-2'] });
  assert.equal(
    db.batchCalls,
    1,
    'idempotent replay must not execute another delete batch',
  );

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

  const valid = await validateProductDependencies(
    productDependencyDb(),
    'section-1',
    parsed.value,
  );
  assert.deepEqual(valid, { ok: true });

  const mismatch = await validateProductDependencies(
    productDependencyDb({
      group: conversionGroupRow({
        mode: 'customer_service',
        targetCount: 1,
        activeTargetCount: 1,
      }),
    }),
    'section-1',
    parsed.value,
  );
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.code, 'CONVERSION_MODE_MISMATCH');
});

test('published products may omit media while offline products may omit an address', async () => {
  const noMedia = validateProductInput(
    baseProductInput({ mediaAssetIds: [], coverAssetId: null }),
  );
  assert.equal(noMedia.ok, true);
  if (!noMedia.ok) return;
  const missingMedia = await validateProductDependencies(
    productDependencyDb({ mediaIds: [] }),
    'section-1',
    noMedia.value,
  );
  assert.equal(missingMedia.ok, true);

  const offline = validateProductInput(
    baseProductInput({
      serviceMode: 'offline',
      address: '',
      conversionGroupId: 'group-1',
    }),
  );
  assert.equal(offline.ok, true);
  if (!offline.ok) return;
  const validWithoutAddress = await validateProductDependencies(
    productDependencyDb({
      group: conversionGroupRow({
        mode: 'customer_service',
        targetCount: 1,
        activeTargetCount: 1,
      }),
    }),
    'section-1',
    offline.value,
  );
  assert.deepEqual(validWithoutAddress, { ok: true });
});

test('product tag bindings enforce uniqueness, section ownership, enable state and the 12-tag cap', async () => {
  assert.equal(parseProductTagIds(['tag-1', 'tag-1']).ok, false);
  assert.equal(
    parseProductTagIds(Array.from({ length: 13 }, (_, index) => `tag-${index}`)).ok,
    false,
  );

  const publishedDisabled = await validateProductTagBindings(
    productTagDb([
      { id: 'tag-1', section_id: 'section-1', is_enabled: 0, deleted_at: null },
    ]),
    'section-1',
    ['tag-1'],
    'published',
  );
  assert.equal(publishedDisabled.ok, false);
  if (!publishedDisabled.ok) assert.equal(publishedDisabled.code, 'PRODUCT_TAG_DISABLED');

  const draftDisabled = await validateProductTagBindings(
    productTagDb([
      { id: 'tag-1', section_id: 'section-1', is_enabled: 0, deleted_at: null },
    ]),
    'section-1',
    ['tag-1'],
    'draft',
  );
  assert.deepEqual(draftDisabled, { ok: true });

  const wrongSection = await validateProductTagBindings(
    productTagDb([
      { id: 'tag-1', section_id: 'section-2', is_enabled: 1, deleted_at: null },
    ]),
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
  assert.deepEqual(
    created.statements.slice(1).map((statement) => statement.args[2]),
    [0, 10],
  );

  const tagStatements = createReplaceProductTagStatements(
    db,
    created.product.id,
    ['tag-a', 'tag-b'],
    NOW,
  );
  assert.equal(tagStatements.length, 3);
  assert.ok(tagStatements[0].sql.includes('DELETE FROM product_tag_bindings'));
  assert.deepEqual(
    tagStatements.slice(1).map((statement) => statement.args[1]),
    ['tag-a', 'tag-b'],
  );

  const updated = createUpdateProductStatements(
    db,
    created.product,
    { ...input, mediaAssetIds: ['media-2', 'media-1'] },
    '2026-08-07T01:00:00.000Z',
  );
  assert.equal(updated.length, 4);
  assert.ok(updated[1].sql.includes('DELETE FROM product_media'));
  assert.deepEqual(
    updated.slice(2).map((statement) => statement.args[1]),
    ['media-2', 'media-1'],
  );
  assert.deepEqual(
    updated.slice(2).map((statement) => statement.args[2]),
    [0, 10],
  );
});

test('bulk permanent product deletion stays bounded and clears stored references', () => {
  const db = recordingDb();
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE products (id TEXT PRIMARY KEY, section_id TEXT, deleted_at TEXT);
    CREATE TABLE h5_page_ctas (product_id TEXT);
    CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY, actor TEXT, action TEXT, entity_type TEXT, entity_id TEXT,
      request_id TEXT, before_json TEXT, after_json TEXT, metadata_json TEXT, created_at TEXT
    );
    INSERT INTO products VALUES
      ('product-1', 'section-1', '${NOW}'),
      ('product-2', 'section-1', '${NOW}'),
      ('product-active', 'section-1', NULL);
    INSERT INTO h5_page_ctas VALUES ('product-1'), ('product-2'), ('product-active');
    INSERT INTO audit_logs VALUES (
      'old-1', 'single_admin', 'product.deleted', 'product', 'product-1',
      'request-1', '{"body":"private","title":"Product One"}',
      '{"media":["private"],"title":"Product One"}', NULL, '${NOW}'
    );
  `);
  const ids = [
    'product-1',
    'product-2',
    ...Array.from({ length: 98 }, (_, index) => `missing-${index}`),
  ];
  const statements = createPermanentDeleteProductStatements(
    db,
    'section-1',
    ids,
    'request-2',
    NOW,
  );

  assert.equal(statements.length, 4, 'statement count must not grow with product count');
  assert.match(statements[0].sql, /UPDATE h5_page_ctas SET product_id = NULL/u);
  assert.match(statements[1].sql, /json_remove\(before_json/u);
  assert.match(statements[1].sql, /json_remove\(after_json/u);
  assert.match(statements[2].sql, /INSERT INTO audit_logs/u);
  assert.match(statements[3].sql, /DELETE FROM products/u);
  for (const statement of statements) {
    sqlite.prepare(statement.sql).run(...statement.args);
  }

  assert.equal(
    sqlite
      .prepare('SELECT COUNT(*) AS count FROM products WHERE deleted_at IS NOT NULL')
      .get().count,
    0,
  );
  assert.equal(
    sqlite
      .prepare("SELECT product_id FROM h5_page_ctas WHERE product_id = 'product-active'")
      .get().product_id,
    'product-active',
  );
  assert.equal(
    sqlite
      .prepare('SELECT COUNT(*) AS count FROM h5_page_ctas WHERE product_id IS NULL')
      .get().count,
    2,
  );
  assert.equal(
    sqlite
      .prepare(
        "SELECT json_extract(before_json, '$.body') AS body FROM audit_logs WHERE id = 'old-1'",
      )
      .get().body,
    null,
  );
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS count FROM audit_logs WHERE action = 'product.permanently_deleted'",
      )
      .get().count,
    2,
  );
  sqlite.close();
});
