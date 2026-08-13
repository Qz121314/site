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

function createDb({ connection = connectionRow(), group = groupRow() } = {}) {
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
        async all() {
          statements.push({ kind: 'all', sql: this.sql, args: this.args });
          if (this.sql.includes('\nFROM customer_service_connections c')) {
            return { results: [connection] };
          }
          throw new Error(`Unexpected all SQL: ${this.sql}`);
        },
        async first() {
          statements.push({ kind: 'first', sql: this.sql, args: this.args });
          if (
            this.sql.includes('FROM products p') &&
            this.sql.includes('JOIN sections s')
          ) {
            return {
              id: 'product-1',
              section_id: 'section-1',
              title: 'Product One',
              conversion_group_id: 'group-1',
            };
          }
          if (this.sql.includes('\nFROM conversion_groups g')) return group;
          if (this.sql.includes('\nFROM customer_service_connections c'))
            return connection;
          throw new Error(`Unexpected first SQL: ${this.sql}`);
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

const publicConnection = {
  id: 'connection-1',
  clientApiUrl: 'https://support.example.com/client/v1',
  realtimeUrl: 'wss://support.example.com/client/v1/realtime',
  protocolVersion: 'v1',
};

test('Storefront exposes only verified public support runtime endpoints', async () => {
  const db = createDb();
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
});

test('Storefront hides unverified support connections', async () => {
  const db = createDb({
    connection: connectionRow({
      client_api_url: null,
      realtime_url: null,
      verified_at: null,
    }),
  });
  const response = await app.request(
    'http://local.test/api/public/storefront/support/connections',
    undefined,
    env(db),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { connections: [] });
});

test('Product support route resolves direct group binding without target rotation', async () => {
  const db = createDb();
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
  assert.equal(
    db.statements.some(({ sql }) =>
      sql.includes('INSERT INTO conversion_group_rotation'),
    ),
    false,
  );
  assert.equal(
    db.statements.some(({ sql }) => sql.includes('FROM conversion_targets t')),
    false,
  );
});
