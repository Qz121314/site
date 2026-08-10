import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CustomerServiceProviderError,
  customerServiceProviderFetchJson,
  listRemoteCustomerServiceGroups,
  testCustomerServiceConnection,
} from '../src/customer-service/customer-service-provider.ts';

function connection(overrides = {}) {
  return {
    id: 'connection-1',
    name: 'Support A',
    provider: 'generic_v1',
    baseUrl: 'https://support.example',
    projectId: 'project-1',
    apiToken: 'secret-token',
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

test('group listing uses management API and keeps private credentials server-side', async () => {
  let request;
  const groups = await withFetch(
    async (url, init) => {
      request = { url, init };
      return new Response(
        JSON.stringify({
          groups: [
            { id: ' sales ', name: ' Sales ', isEnabled: true },
            { id: 'vip', name: 'VIP' },
            { id: 'off', name: 'Off', isEnabled: false },
            { id: ' ', name: 'ignored' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
    () => listRemoteCustomerServiceGroups(connection()),
  );

  assert.equal(request.url, 'https://support.example/management/v1/groups');
  const headers = new Headers(request.init.headers);
  assert.equal(headers.get('authorization'), 'Bearer secret-token');
  assert.equal(headers.get('x-project-id'), 'project-1');
  assert.equal(request.init.redirect, 'error');
  assert.deepEqual(groups, [
    { id: 'sales', name: 'Sales', isEnabled: true },
    { id: 'vip', name: 'VIP', isEnabled: true },
    { id: 'off', name: 'Off', isEnabled: false },
  ]);
});

test('connection test reports the number of readable remote groups', async () => {
  const result = await withFetch(
    async () =>
      new Response(
        JSON.stringify({
          groups: [
            { id: 'sales', name: 'Sales' },
            { id: 'vip', name: 'VIP' },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    () => testCustomerServiceConnection(connection()),
  );

  assert.deepEqual(result, { connected: true, groupCount: 2 });
});

test('provider transport rejects disabled connections before fetch', async () => {
  let called = false;
  await assert.rejects(
    withFetch(
      async () => {
        called = true;
        throw new Error('should not run');
      },
      () =>
        customerServiceProviderFetchJson(
          connection({ isEnabled: false }),
          '/management/v1/groups',
        ),
    ),
    (error) =>
      error instanceof CustomerServiceProviderError &&
      error.code === 'CUSTOMER_SERVICE_CONNECTION_DISABLED',
  );
  assert.equal(called, false);
});

test('provider transport rejects non-JSON responses and redirects', async () => {
  await assert.rejects(
    withFetch(
      async () =>
        new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }),
      () => customerServiceProviderFetchJson(connection(), '/management/v1/groups'),
    ),
    (error) =>
      error instanceof CustomerServiceProviderError &&
      error.code === 'CUSTOMER_SERVICE_INVALID_RESPONSE',
  );

  await assert.rejects(
    withFetch(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://other.example' },
        }),
      () => customerServiceProviderFetchJson(connection(), '/management/v1/groups'),
    ),
    (error) => error instanceof CustomerServiceProviderError,
  );
});
