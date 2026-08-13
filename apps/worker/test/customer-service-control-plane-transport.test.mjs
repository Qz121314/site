import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyCustomerServiceIntegration } from '../src/customer-service/customer-service-provider.ts';

function connection(overrides = {}) {
  return {
    id: 'connection-1',
    name: 'Support A',
    provider: 'generic_v1',
    baseUrl: 'https://customer-service-app.fcqz121314.workers.dev',
    verifyToken: 'secret-token',
    hasVerifyToken: true,
    clientApiUrl: null,
    realtimeUrl: null,
    verifiedAt: null,
    isEnabled: true,
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
    deletedAt: null,
    targetCount: 0,
    ...overrides,
  };
}

function integrationEnvelope() {
  return {
    ok: true,
    protocolVersion: 'v1',
    clientApiUrl:
      'https://customer-service-app.fcqz121314.workers.dev/client/v1',
    realtimeUrl:
      'wss://customer-service-app.fcqz121314.workers.dev/client/v1/realtime',
    groups: [{ id: 'general', name: '默认客服组', isEnabled: true }],
  };
}

test('same-account workers.dev verification uses the control-plane service binding when available', async () => {
  const originalFetch = globalThis.fetch;
  let publicFetchCalled = false;
  let boundRequest;
  globalThis.fetch = async () => {
    publicFetchCalled = true;
    throw new Error('public fetch should not be used for the bound target');
  };

  try {
    const result = await verifyCustomerServiceIntegration(connection(), {
      internalService: {
        async fetch(url, init) {
          boundRequest = { url, init };
          return new Response(JSON.stringify(integrationEnvelope()), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        },
      },
    });

    assert.equal(publicFetchCalled, false);
    assert.equal(
      boundRequest.url,
      'https://customer-service-app.fcqz121314.workers.dev/integration/v1/verify',
    );
    assert.equal(
      new Headers(boundRequest.init.headers).get('authorization'),
      'Bearer secret-token',
    );
    assert.deepEqual(result.groups, [
      { id: 'general', name: '默认客服组', isEnabled: true },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
