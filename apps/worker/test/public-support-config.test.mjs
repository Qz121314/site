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
    project_id: 'site-main',
    api_token: 'private-management-token',
    is_enabled: 1,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    target_count: 1,
    ...overrides,
  };
}

function groupRow() {
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
    target_count: 1,
    active_target_count: 1,
    product_count: 1,
  };
}

function targetRow() {
  return {
    id: 'target-1',
    section_id: 'section-1',
    group_id: 'group-1',
    group_mode: 'customer_service',
    name: 'Sales',
    endpoint_url: null,
    customer_service_connection_id: 'connection-1',
    customer_service_connection_name: 'Primary Support',
    remote_group_id: 'sales',
    remote_group_name: 'Sales',
    sort_order: 0,
    is_enabled: 1,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
  };
}

function createDb() {
  const statements = [];
  const connection = connectionRow();
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
          if (this.sql.includes('FROM customer_service_connections c')) {
            return { results: [connection] };
          }
          if (this.sql.includes('FROM conversion_targets t')) {
            return { results: [targetRow()] };
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
          if (this.sql.includes('FROM conversion_groups g')) return groupRow();
          if (this.sql.includes('FROM customer_service_connections c')) return connection;
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

test('Storefront can read enabled public support connections without management token', async () => {
  const db = createDb();
  const response = await app.request(
    'http://local.test/api/public/storefront/support/connections',
    undefined,
    env(db),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    connections: [
      {
        id: 'connection-1',
        baseUrl: 'https://support.example.com',
        projectId: 'site-main',
        protocolVersion: 'v1',
      },
    ],
  });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('Product support route resolves connection and group without consuming round-robin', async () => {
  const db = createDb();
  const response = await app.request(
    'http://local.test/api/public/storefront/support/route/product-1?sectionId=section-1',
    undefined,
    env(db),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    available: true,
    connection: {
      id: 'connection-1',
      baseUrl: 'https://support.example.com',
      projectId: 'site-main',
      protocolVersion: 'v1',
    },
    groupId: 'sales',
  });
  assert.equal(
    db.statements.some(({ sql }) =>
      sql.includes('INSERT INTO conversion_group_rotation'),
    ),
    false,
  );
});
