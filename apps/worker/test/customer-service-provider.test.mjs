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
    productCatalog: { productCount: 12 },
    ...overrides,
  };
}

test('integration parser validates public runtime endpoints and product sync', () => {
  assert.deepEqual(parseCustomerServiceIntegration(integrationEnvelope()), {
    protocolVersion: 'v1',
    clientApiUrl: 'https://support.example/client/v1',
    realtimeUrl: 'wss://support.example/client/v1/realtime',
    productCount: 12,
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

test('integration parser rejects malformed product catalog result', () => {
  assert.throws(
    () =>
      parseCustomerServiceIntegration(
        integrationEnvelope({ productCatalog: { productCount: -1 } }),
      ),
    (error) =>
      error instanceof CustomerServiceProviderError &&
      error.code === 'CUSTOMER_SERVICE_INVALID_PRODUCT_CATALOG',
  );
});
