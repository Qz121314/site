import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../src/index.ts';

const NOW = '2026-08-07T00:00:00.000Z';

function groupRow({ mode = 'link', activeTargetCount = 1 } = {}) {
  return {
    id: 'group-1',
    section_id: 'section-1',
    name: mode === 'link' ? 'Links' : 'Support',
    mode,
    button_label: 'Contact',
    rotation_strategy: 'round_robin',
    sort_order: 0,
    is_enabled: 1,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    target_count: activeTargetCount,
    active_target_count: activeTargetCount,
    product_count: 1,
  };
}

function targetRow({ id, name, sortOrder, endpointUrl }) {
  return {
    id,
    section_id: 'section-1',
    group_id: 'group-1',
    group_mode: 'link',
    name,
    endpoint_url: endpointUrl,
    customer_service_connection_id: null,
    customer_service_connection_name: null,
    remote_group_id: null,
    remote_group_name: null,
    sort_order: sortOrder,
    is_enabled: 1,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
  };
}

function createConversionDb({
  product = {
    id: 'product-1',
    section_id: 'section-1',
    title: 'Product One',
    conversion_group_id: 'group-1',
  },
  group = groupRow(),
  targets = [],
} = {}) {
  let nextIndex = 0;
  const statements = [];

  return {
    statements,
    get cursor() {
      return nextIndex;
    },
    prepare(sql) {
      const statement = {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          statements.push({ kind: 'first', sql: this.sql, args: this.args });
          if (
            this.sql.includes('FROM products p') &&
            this.sql.includes('JOIN sections s')
          ) {
            return product;
          }
          if (this.sql.includes('FROM conversion_groups g')) return group;
          if (this.sql.includes('INSERT INTO conversion_group_rotation')) {
            const selected = nextIndex;
            nextIndex += 1;
            return { selected_index: selected };
          }
          if (this.sql.includes('FROM conversion_targets t')) {
            const offset = Number(this.args.at(-1));
            return targets[offset % Math.max(1, targets.length)] ?? null;
          }
          throw new Error(`Unexpected first SQL: ${this.sql}`);
        },
        async run() {
          statements.push({ kind: 'run', sql: this.sql, args: this.args });
          return { success: true, meta: { changes: 1 } };
        },
      };
      return statement;
    },
  };
}

function env(db) {
  return {
    DB: db,
    ASSETS_BUCKET: {},
    ASSETS: {},
    ENVIRONMENT: 'test',
    APP_VERSION: 'test',
  };
}

function trafficWrites(db) {
  return db.statements.filter(
    ({ kind, sql }) =>
      kind === 'run' && /INSERT(?: OR IGNORE)? INTO conversion_events/u.test(sql),
  );
}

test('GET /go/:code keeps link targets on production round-robin without a Site traffic write', async () => {
  const targets = [
    targetRow({
      id: 'a',
      name: 'A',
      sortOrder: 10,
      endpointUrl: 'https://a.example/path',
    }),
    targetRow({
      id: 'b',
      name: 'B',
      sortOrder: 20,
      endpointUrl: 'https://b.example/path',
    }),
    targetRow({
      id: 'c',
      name: 'C',
      sortOrder: 30,
      endpointUrl: 'https://c.example/path',
    }),
  ];
  const db = createConversionDb({ group: groupRow({ activeTargetCount: 3 }), targets });

  const locations = [];
  for (let index = 0; index < 4; index += 1) {
    const response = await app.request(
      'http://local.test/go/product-1',
      undefined,
      env(db),
    );
    assert.equal(response.status, 302);
    locations.push(response.headers.get('location'));
    assert.equal(response.headers.get('cache-control'), 'no-store, private');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  }

  assert.deepEqual(locations, [
    'https://a.example/path',
    'https://b.example/path',
    'https://c.example/path',
    'https://a.example/path',
  ]);
  assert.equal(db.cursor, 4);
  assert.equal(trafficWrites(db).length, 0);
});

test('GET realtime CTA state reads current configuration without consuming round-robin', async () => {
  const db = createConversionDb({
    group: groupRow({ mode: 'link', activeTargetCount: 2 }),
  });
  const response = await app.request(
    'http://local.test/api/public/storefront/cta/product-1',
    undefined,
    env(db),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    available: true,
    label: 'Contact',
    mode: 'link',
    path: '/go/product-1',
  });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(db.cursor, 0);
});

test('GET realtime CTA state hides unavailable or unbound conversion configuration', async () => {
  const disabledDb = createConversionDb({ group: groupRow({ activeTargetCount: 0 }) });
  const disabled = await app.request(
    'http://local.test/api/public/storefront/cta/product-1',
    undefined,
    env(disabledDb),
  );
  assert.deepEqual(await disabled.json(), { available: false });
  assert.equal(disabledDb.cursor, 0);

  const unboundDb = createConversionDb({
    product: {
      id: 'product-1',
      section_id: 'section-1',
      title: 'Product One',
      conversion_group_id: null,
    },
  });
  const unbound = await app.request(
    'http://local.test/api/public/storefront/cta/product-1',
    undefined,
    env(unboundDb),
  );
  assert.deepEqual(await unbound.json(), { available: false });
  assert.equal(unboundDb.cursor, 0);
});

test('customer-service CTA stays inside Site Messages, generates a handoff ID, and does not write a Site traffic ledger', async () => {
  const db = createConversionDb({
    group: groupRow({ mode: 'customer_service', activeTargetCount: 2 }),
  });
  const originalFetch = globalThis.fetch;
  let upstreamCalled = false;
  globalThis.fetch = async () => {
    upstreamCalled = true;
    throw new Error('customer-service CTA must not call a provider');
  };

  try {
    const response = await app.request(
      'http://local.test/go/product-1',
      undefined,
      env(db),
    );
    assert.equal(response.status, 302);
    const location = response.headers.get('location');
    const redirect = new URL(location, 'http://local.test');
    assert.equal(redirect.pathname, '/messages/new/');
    assert.equal(redirect.searchParams.get('productId'), 'product-1');
    assert.equal(redirect.searchParams.get('sectionId'), 'section-1');
    assert.match(redirect.searchParams.get('handoffId') ?? '', /^[0-9a-f-]{36}$/u);
    assert.equal(db.cursor, 0);
    assert.equal(upstreamCalled, false);
    assert.equal(
      db.statements.some(({ sql }) =>
        sql.includes('INSERT INTO conversion_group_rotation'),
      ),
      false,
    );
    assert.equal(trafficWrites(db).length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('customer-service CTA can return the compose path for SPA navigation without a Site traffic write', async () => {
  const db = createConversionDb({
    group: groupRow({ mode: 'customer_service', activeTargetCount: 2 }),
  });
  const response = await app.request(
    'http://local.test/go/product-1',
    { headers: { Accept: 'application/json' } },
    env(db),
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  const compose = new URL(payload.path, 'http://local.test');
  assert.equal(compose.pathname, '/messages/new/');
  assert.equal(compose.searchParams.get('productId'), 'product-1');
  assert.equal(compose.searchParams.get('sectionId'), 'section-1');
  assert.match(compose.searchParams.get('handoffId') ?? '', /^[0-9a-f-]{36}$/u);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.equal(db.cursor, 0);
  assert.equal(trafficWrites(db).length, 0);
});

test('invalid or unpublished products never consume the production cursor', async () => {
  const invalidDb = createConversionDb({ targets: [] });
  const invalidResponse = await app.request(
    'http://local.test/go/not%20valid',
    undefined,
    env(invalidDb),
  );
  assert.equal(invalidResponse.status, 404);
  assert.equal(invalidDb.cursor, 0);

  const missingDb = createConversionDb({ product: null, targets: [] });
  const missingResponse = await app.request(
    'http://local.test/go/missing-product',
    undefined,
    env(missingDb),
  );
  assert.equal(missingResponse.status, 404);
  assert.equal(missingDb.cursor, 0);
});
