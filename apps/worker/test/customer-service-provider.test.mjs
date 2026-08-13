import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CustomerServiceProviderError,
  listRemoteCustomerServiceGroups,
  verifyCustomerServiceIntegration,
} from '../src/customer-service/customer-service-provider.ts';

function connection(overrides = {}) {
  return {
    id: 'connection-1',
    name: 'Support A',
    provider: 'generic_v1',
    baseUrl: 'https://support.example',
    verifyToken: 'secret-token',
    hasVerifyToken: true,
    clientApiUrl: null,
    realtimeUrl: null,
    verifiedAt: null,
    isEnabled: true,
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z',
    deletedAt: null,
    targetCount: 0,
    ...overrides,
  };
}

function integrationEnvelope(overrides = {}) {
  return {
    ok: true,
    protocolVersion: 'v1',
    clientApiUrl: 'https://support.example/client/v1',
    realtimeUrl: 'wss://support.example/client/v1/realtime',
    groups: [
      { id: ' sales ', name: ' Sales ', isEnabled: true },
      { id: 'vip', name: 'VIP' },
      { id: 'off', name: 'Off', isEnabled: false },
      { id: ' ', name: 'ignored' },
    ],
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

test('integration verification uses Bearer token and returns public runtime endpoints', async () => {
  let request;
  const result = await withFetch(
    async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify(integrationEnvelope()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
    () => verifyCustomerServiceIntegration(connection()),
  );

  assert.equal(request.url, 'https://support.example/integration/v1/verify');
  assert.equal(request.init.method, 'POST');
  const headers = new Headers(request.init.headers);
  assert.equal(headers.get('authorization'), 'Bearer secret-token');
  assert.equal(headers.has('x-project-id'), false);
  assert.equal(request.init.redirect, 'error');
  assert.deepEqual(result, {
    protocolVersion: 'v1',
    clientApiUrl: 'https://support.example/client/v1',
    realtimeUrl: 'wss://support.example/client/v1/realtime',
    groups: [
      { id: 'sales', name: 'Sales', isEnabled: true },
      { id: 'vip', name: 'VIP', isEnabled: true },
      { id: 'off', name: 'Off', isEnabled: false },
    ],
  });
});

test('remote group listing reuses integration verification and keeps token server-side', async () => {
  const groups = await withFetch(
    async () =>
      new Response(JSON.stringify(integrationEnvelope()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    () => listRemoteCustomerServiceGroups(connection()),
  );

  assert.deepEqual(groups, [
    { id: 'sales', name: 'Sales', isEnabled: true },
    { id: 'vip', name: 'VIP', isEnabled: true },
    { id: 'off', name: 'Off', isEnabled: false },
  ]);
});

test('workers.dev customer service verification uses the configured public URL', async () => {
  let request;
  const baseUrl = 'https://customer-service-app.fcqz121314.workers.dev';
  const result = await withFetch(
    async (url, init) => {
      request = { url, init };
      return new Response(
        JSON.stringify(
          integrationEnvelope({
            clientApiUrl: `${baseUrl}/client/v1`,
            realtimeUrl:
              'wss://customer-service-app.fcqz121314.workers.dev/client/v1/realtime',
            groups: [{ id: 'general', name: '默认客服组', isEnabled: true }],
          }),
        ),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    },
    () => verifyCustomerServiceIntegration(connection({ baseUrl })),
  );

  assert.equal(request.url, `${baseUrl}/integration/v1/verify`);
  const headers = new Headers(request.init.headers);
  assert.equal(headers.get('authorization'), 'Bearer secret-token');
  assert.deepEqual(result.groups, [
    { id: 'general', name: '默认客服组', isEnabled: true },
  ]);
});

test('provider rejects disabled connections before fetch', async () => {
  let called = false;
  await assert.rejects(
    withFetch(
      async () => {
        called = true;
        throw new Error('should not run');
      },
      () => verifyCustomerServiceIntegration(connection({ isEnabled: false })),
    ),
    (error) =>
      error instanceof CustomerServiceProviderError &&
      error.code === 'CUSTOMER_SERVICE_CONNECTION_DISABLED',
  );
  assert.equal(called, false);
});

test('provider requires a verification token before fetch', async () => {
  let called = false;
  await assert.rejects(
    withFetch(
      async () => {
        called = true;
        throw new Error('should not run');
      },
      () =>
        verifyCustomerServiceIntegration(
          connection({ verifyToken: null, hasVerifyToken: false }),
        ),
    ),
    (error) =>
      error instanceof CustomerServiceProviderError &&
      error.code === 'CUSTOMER_SERVICE_VERIFY_TOKEN_REQUIRED',
  );
  assert.equal(called, false);
});

test('provider maps invalid verification token to a specific error', async () => {
  await assert.rejects(
    withFetch(
      async () =>
        new Response(JSON.stringify({ error: { code: 'INVALID_VERIFY_TOKEN' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      () => verifyCustomerServiceIntegration(connection()),
    ),
    (error) =>
      error instanceof CustomerServiceProviderError &&
      error.code === 'CUSTOMER_SERVICE_VERIFY_TOKEN_INVALID',
  );
});

test('provider rejects non-JSON and invalid runtime endpoint responses', async () => {
  await assert.rejects(
    withFetch(
      async () =>
        new Response('ok', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
      () => verifyCustomerServiceIntegration(connection()),
    ),
    (error) =>
      error instanceof CustomerServiceProviderError &&
      error.code === 'CUSTOMER_SERVICE_INVALID_RESPONSE',
  );

  await assert.rejects(
    withFetch(
      async () =>
        new Response(
          JSON.stringify(
            integrationEnvelope({
              realtimeUrl: 'https://support.example/client/v1/realtime',
            }),
          ),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      () => verifyCustomerServiceIntegration(connection()),
    ),
    (error) =>
      error instanceof CustomerServiceProviderError &&
      error.code === 'CUSTOMER_SERVICE_INVALID_RESPONSE',
  );
});
