import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CustomerServiceProviderError,
  parseCustomerServiceIntegration,
} from '../src/customer-service/customer-service-provider.ts';

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

test('integration parser validates and normalizes public runtime endpoints', () => {
  assert.deepEqual(parseCustomerServiceIntegration(integrationEnvelope()), {
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

test('integration parser rejects invalid protocol envelopes', () => {
  assert.throws(
    () => parseCustomerServiceIntegration({ ok: true, protocolVersion: 'v2' }),
    (error) =>
      error instanceof CustomerServiceProviderError &&
      error.code === 'CUSTOMER_SERVICE_INVALID_RESPONSE',
  );
});

test('integration parser requires HTTPS client endpoint', () => {
  assert.throws(
    () =>
      parseCustomerServiceIntegration(
        integrationEnvelope({ clientApiUrl: 'http://support.example/client/v1' }),
      ),
    (error) =>
      error instanceof CustomerServiceProviderError &&
      error.code === 'CUSTOMER_SERVICE_INVALID_RESPONSE',
  );
});

test('integration parser requires WSS realtime endpoint', () => {
  assert.throws(
    () =>
      parseCustomerServiceIntegration(
        integrationEnvelope({
          realtimeUrl: 'https://support.example/client/v1/realtime',
        }),
      ),
    (error) =>
      error instanceof CustomerServiceProviderError &&
      error.code === 'CUSTOMER_SERVICE_INVALID_RESPONSE',
  );
});

test('integration parser rejects malformed groups', () => {
  assert.throws(
    () => parseCustomerServiceIntegration(integrationEnvelope({ groups: {} })),
    (error) =>
      error instanceof CustomerServiceProviderError &&
      error.code === 'CUSTOMER_SERVICE_INVALID_GROUPS',
  );
});
