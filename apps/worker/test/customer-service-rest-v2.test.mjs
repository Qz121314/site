import assert from 'node:assert/strict';
import test from 'node:test';
import {
  listRemoteCustomerServiceGroups,
  resolveCustomerServiceGroupEntry,
} from '../src/customer-service/customer-service-provider.ts';

function connection(overrides = {}) {
  return {
    id: 'rest-connection',
    name: 'REST Support',
    provider: 'generic_rest_v2',
    baseUrl: 'https://support.example/api',
    projectId: null,
    apiToken: 'secret-token',
    hasApiToken: true,
    privateConfig: null,
    isEnabled: true,
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z',
    deletedAt: null,
    targetCount: 0,
    ...overrides,
  };
}

async function withFetch(mock, callback) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await callback();
  } finally {
    globalThis.fetch = original;
  }
}

test('REST v2 defaults require only API root and bearer token', async () => {
  let request;
  const groups = await withFetch(
    async (url, init) => {
      request = { url, init };
      return new Response(
        JSON.stringify({
          groups: [
            { group_id: 12, display_name: 'Sales', status: 'active' },
            { group_id: 15, display_name: 'Offline', status: 'disabled' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } },
      );
    },
    () => listRemoteCustomerServiceGroups(connection()),
  );

  assert.equal(request.url, 'https://support.example/api/groups');
  const headers = new Headers(request.init.headers);
  assert.equal(headers.get('authorization'), 'Bearer secret-token');
  assert.deepEqual(groups, [
    { id: '12', name: 'Sales', isEnabled: true },
    { id: '15', name: 'Offline', isEnabled: false },
  ]);
});

test('REST v2 supports API-key headers and custom response mapping', async () => {
  let request;
  const privateConfig = JSON.stringify({
    auth: { type: 'api_key', headerName: 'X-Service-Key' },
    groups: {
      path: '/v2/teams',
      itemsPath: 'data.teams',
      idPath: 'team.code',
      namePath: 'team.label',
      enabledPath: 'active',
    },
  });

  const groups = await withFetch(
    async (url, init) => {
      request = { url, init };
      return new Response(
        JSON.stringify({ data: { teams: [{ team: { code: 'vip', label: 'VIP' }, active: 1 }] } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
    () => listRemoteCustomerServiceGroups(connection({ privateConfig })),
  );

  assert.equal(request.url, 'https://support.example/api/v2/teams');
  const headers = new Headers(request.init.headers);
  assert.equal(headers.get('x-service-key'), 'secret-token');
  assert.equal(headers.get('authorization'), null);
  assert.deepEqual(groups, [{ id: 'vip', name: 'VIP', isEnabled: true }]);
});

test('REST v2 can resolve a session using a direct URL template without another API request', async () => {
  let called = false;
  const privateConfig = JSON.stringify({
    entry: {
      mode: 'template',
      urlTemplate: 'https://chat.example/start?team={groupId}',
    },
  });

  const result = await withFetch(
    async () => {
      called = true;
      throw new Error('should not fetch');
    },
    () => resolveCustomerServiceGroupEntry(connection({ privateConfig }), 'sales / vip', {
      requestId: 'request-1',
      productId: 'product-1',
      sectionId: 'section-1',
    }),
  );

  assert.equal(called, false);
  assert.equal(result.url, 'https://chat.example/start?team=sales%20%2F%20vip');
});

test('REST v2 supports GET entry endpoints and automatic nested URL discovery', async () => {
  let request;
  const privateConfig = JSON.stringify({
    entry: {
      method: 'GET',
      pathTemplate: '/teams/{groupId}/session',
    },
  });

  const result = await withFetch(
    async (url, init) => {
      request = { url, init };
      return new Response(
        JSON.stringify({ data: { entry_url: 'https://chat.example/session/abc' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
    () => resolveCustomerServiceGroupEntry(connection({ privateConfig }), 'vip', {
      requestId: 'request-1',
      productId: 'product-1',
      sectionId: 'section-1',
    }),
  );

  assert.equal(request.url, 'https://support.example/api/teams/vip/session');
  assert.equal(request.init.method, 'GET');
  assert.equal(request.init.body, undefined);
  assert.equal(result.url, 'https://chat.example/session/abc');
});
