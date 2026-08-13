import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../src/index.ts';

const NOW = '2026-08-09T12:00:00.000Z';

function connectionRow(overrides = {}) {
  return {
    id: 'connection-1',
    name: 'Primary Support',
    provider: 'generic_v1',
    base_url: 'https://support.example.com',
    project_id: null,
    api_token: 'private-verify-token',
    client_api_url: 'https://support.example.com/client/v1',
    realtime_url: 'wss://support.example.com/client/v1/realtime',
    verified_at: NOW,
    is_enabled: 1,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    target_count: 1,
    ...overrides,
  };
}

function groupRow(overrides = {}) {
  return {
    id: 'group-1',
    section_id: 'section-1',
    name: 'Support',
    mode: 'customer_service',
    button_label: 'Contact',
    rotation_strategy: 'round_robin',
    sort_order: 0,
    is_enabled: 1,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    target_count: 0,
    active_target_count: 1,
    product_count: 1,
    customer_service_connection_id: 'connection-1',
    customer_service_connection_name: 'Primary Support',
    remote_group_id: 'sales',
    remote_group_name: 'Sales',
    ...overrides,
  };
}

function productRow() {
  return {
    id: 'product-1',
    section_id: 'section-1',
    title: 'Product One',
    conversion_group_id: 'group-1',
  };
}

function createDb(steps) {
  const remaining = [...steps];
  const calls = [];

  function consume(kind, sql, args) {
    const step = remaining.shift();
    calls.push({ kind, args });
    if (!step) throw new Error(`Unexpected ${kind} database call.`);
    assert.equal(kind, step.kind);
    return step.result;
  }

  return {
    calls,
    get remainingSteps() {
      return remaining.length;
    },
    prepare(sql) {
      return {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async all() {
          return consume('all', this.sql, this.args);
        },
        async first() {
          return consume('first', this.sql, this.args);
        },
      };
    },
  };
}

function connectionListDb(connection = connectionRow()) {
  return createDb([{ kind: 'all', result: { results: [connection] } }]);
}

function supportRouteDb({ connection = connectionRow(), group = groupRow() } = {}) {
  return createDb([
    { kind: 'first', result: productRow() },
    { kind: 'first', result: group },
    { kind: 'first', result: connection },
  ]);
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

const publicConnection = {
  id: 'connection-1',
  clientApiUrl: 'https://support.example.com/client/v1',
  realtimeUrl: 'wss://support.example.com/client/v1/realtime',
  protocolVersion: 'v1',
};

test('Storefront exposes only verified public support runtime endpoints', async () => {
  const db = connectionListDb();
  const response = await app.request(
    'http://local.test/api/public/storefront/support/connections',
    undefined,
    env(db),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    connections: [publicConnection],
  });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(db.remainingSteps, 0);
});

test('Storefront hides unverified support connections', async () => {
  const db = connectionListDb(
    connectionRow({
      client_api_url: null,
      realtime_url: null,
      verified_at: null,
    }),
  );
  const response = await app.request(
    'http://local.test/api/public/storefront/support/connections',
    undefined,
    env(db),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { connections: [] });
  assert.equal(db.remainingSteps, 0);
});

test('Product support route resolves direct group binding without target rotation', async () => {
  const db = supportRouteDb();
  const response = await app.request(
    'http://local.test/api/public/storefront/support/route/product-1?sectionId=section-1',
    undefined,
    env(db),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    available: true,
    connection: publicConnection,
    groupId: 'sales',
  });
  assert.equal(db.remainingSteps, 0);
  assert.deepEqual(
    db.calls.map(({ kind }) => kind),
    ['first', 'first', 'first'],
  );
});
