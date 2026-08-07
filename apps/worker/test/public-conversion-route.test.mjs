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

function targetRow({ id, name, sortOrder, mode = 'link', endpointUrl = null, connectionId = null, remoteGroupId = null }) {
  return {
    id,
    section_id: 'section-1',
    group_id: 'group-1',
    group_mode: mode,
    name,
    endpoint_url: endpointUrl,
    customer_service_connection_id: connectionId,
    customer_service_connection_name: connectionId ? 'Support A' : null,
    remote_group_id: remoteGroupId,
    remote_group_name: remoteGroupId ? name : null,
    sort_order: sortOrder,
    is_enabled: 1,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
  };
}

function connectionRow() {
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
    target_count: 2,
  };
}

function createConversionDb({
  product = { id: 'product-1', section_id: 'section-1', conversion_group_id: 'group-1' },
  group = groupRow(),
  targets = [],
  connection = null,
} = {}) {
  let nextIndex = 0;
  const events = [];
  const statements = [];

  const db = {
    events,
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
          if (this.sql.includes('FROM products p') && this.sql.includes('JOIN sections s')) {
            return product;
          }
          if (this.sql.includes('FROM conversion_groups g')) {
            return group;
          }
          if (this.sql.includes('INSERT INTO conversion_group_rotation')) {
            const selected = nextIndex;
            nextIndex += 1;
            return { selected_index: selected };
          }
          if (/FROM customer_service_connections c(?:\s|$)/u.test(this.sql)) {
            return connection;
          }
          if (this.sql.includes('FROM conversion_targets t')) {
            const offset = Number(this.args.at(-1));
            return targets[offset % Math.max(1, targets.length)] ?? null;
          }
          throw new Error(`Unexpected first SQL: ${this.sql}`);
        },
        async run() {
          statements.push({ kind: 'run', sql: this.sql, args: this.args });
          if (this.sql.includes('INSERT INTO conversion_events')) {
            events.push({
              sectionId: this.args[1],
              productId: this.args[2],
              conversionGroupId: this.args[3],
              conversionTargetId: this.args[4],
              mode: this.args[5],
              outcome: this.args[6],
              requestId: this.args[7],
              metadata: this.args[8] ? JSON.parse(this.args[8]) : null,
            });
            return { success: true, meta: { changes: 1 } };
          }
          throw new Error(`Unexpected run SQL: ${this.sql}`);
        },
      };
      return statement;
    },
  };

  return db;
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

test('GET /go/:code performs the full link round-robin and records the selected target', async () => {
  const targets = [
    targetRow({ id: 'a', name: 'A', sortOrder: 10, endpointUrl: 'https://a.example/path' }),
    targetRow({ id: 'b', name: 'B', sortOrder: 20, endpointUrl: 'https://b.example/path' }),
    targetRow({ id: 'c', name: 'C', sortOrder: 30, endpointUrl: 'https://c.example/path' }),
  ];
  const db = createConversionDb({ group: groupRow({ activeTargetCount: 3 }), targets });

  const locations = [];
  for (let index = 0; index < 4; index += 1) {
    const response = await app.request('http://local.test/go/product-1', undefined, env(db));
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
  assert.deepEqual(db.events.map((event) => event.conversionTargetId), ['a', 'b', 'c', 'a']);
  assert.ok(db.events.every((event) => event.outcome === 'redirected' && event.mode === 'link'));
  assert.ok(db.events.every((event) => typeof event.requestId === 'string' && event.requestId.length > 0));
});

test('GET /go/:code resolves a customer-service group through its private connection and records the remote binding', async () => {
  const db = createConversionDb({
    group: groupRow({ mode: 'customer_service', activeTargetCount: 1 }),
    targets: [
      targetRow({
        id: 'sales-target',
        name: 'Sales',
        sortOrder: 10,
        mode: 'customer_service',
        connectionId: 'connection-1',
        remoteGroupId: 'sales/team',
      }),
    ],
    connection: connectionRow(),
  });

  const originalFetch = globalThis.fetch;
  let upstreamRequest = null;
  globalThis.fetch = async (input, init) => {
    upstreamRequest = { input: String(input), init };
    return new Response(JSON.stringify({ url: 'https://chat.example/session/123' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const response = await app.request('http://local.test/go/product-1', undefined, env(db));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), 'https://chat.example/session/123');
    assert.equal(upstreamRequest?.input, 'https://support.example/groups/sales%2Fteam/entry');
    assert.equal(upstreamRequest?.init?.method, 'POST');
    const headers = new Headers(upstreamRequest?.init?.headers);
    assert.equal(headers.get('authorization'), 'Bearer private-token');
    assert.equal(headers.get('x-project-id'), 'project-1');
    const payload = JSON.parse(upstreamRequest?.init?.body);
    assert.equal(payload.productId, 'product-1');
    assert.equal(payload.sectionId, 'section-1');
    assert.equal(typeof payload.requestId, 'string');

    assert.equal(db.events.length, 1);
    assert.deepEqual(db.events[0], {
      sectionId: 'section-1',
      productId: 'product-1',
      conversionGroupId: 'group-1',
      conversionTargetId: 'sales-target',
      mode: 'customer_service',
      outcome: 'redirected',
      requestId: db.events[0].requestId,
      metadata: {
        customerServiceConnectionId: 'connection-1',
        remoteGroupId: 'sales/team',
        remoteGroupName: 'Sales',
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('provider failure returns 502 but still records the exact selected customer-service target', async () => {
  const db = createConversionDb({
    group: groupRow({ mode: 'customer_service', activeTargetCount: 1 }),
    targets: [
      targetRow({
        id: 'support-target',
        name: 'Support',
        sortOrder: 10,
        mode: 'customer_service',
        connectionId: 'connection-1',
        remoteGroupId: 'support',
      }),
    ],
    connection: connectionRow(),
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('upstream failed', { status: 503 });
  try {
    const response = await app.request('http://local.test/go/product-1', undefined, env(db));
    assert.equal(response.status, 502);
    assert.equal(await response.text(), 'Customer service is temporarily unavailable.');
    assert.equal(db.cursor, 1);
    assert.equal(db.events.length, 1);
    assert.equal(db.events[0].conversionTargetId, 'support-target');
    assert.equal(db.events[0].outcome, 'provider_error');
    assert.equal(db.events[0].metadata.providerCode, 'CUSTOMER_SERVICE_UPSTREAM_ERROR');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('invalid or unpublished products never consume the production cursor', async () => {
  const invalidDb = createConversionDb({ targets: [] });
  const invalidResponse = await app.request('http://local.test/go/not%20valid', undefined, env(invalidDb));
  assert.equal(invalidResponse.status, 404);
  assert.equal(invalidDb.cursor, 0);
  assert.equal(invalidDb.events.length, 0);

  const missingDb = createConversionDb({ product: null, targets: [] });
  const missingResponse = await app.request('http://local.test/go/missing-product', undefined, env(missingDb));
  assert.equal(missingResponse.status, 404);
  assert.equal(missingDb.cursor, 0);
  assert.equal(missingDb.events.length, 0);
});
