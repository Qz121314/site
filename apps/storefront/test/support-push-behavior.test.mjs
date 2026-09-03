import assert from 'node:assert/strict';
import test from 'node:test';

const publicKeyOne = new Uint8Array([1, 2, 3, 4]).buffer;
const publicKeyTwo = new Uint8Array([5, 6, 7, 8]).buffer;
const publicKeyOneBase64 = 'AQIDBA';
const publicKeyTwoBase64 = 'BQYHCA';
const cacheEntries = new Map();
const fetchCalls = [];
let currentSubscription = null;
let configKey = publicKeyOneBase64;
let unsubscribeCount = 0;

const storage = new Map();
const localStorage = {
  getItem(key) {
    return storage.get(key) ?? null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
};

function makeCacheResponse(value) {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
  });
}

const cache = {
  async match(key) {
    return cacheEntries.get(String(key))?.clone();
  },
  async put(key, response) {
    cacheEntries.set(String(key), response.clone());
  },
};

function makeSubscription(endpoint, applicationServerKey) {
  return {
    endpoint,
    expirationTime: null,
    options: { applicationServerKey },
    async unsubscribe() {
      unsubscribeCount += 1;
      currentSubscription = null;
      return true;
    },
  };
}

function resetIdentity(token = 'a'.repeat(32)) {
  storage.set(
    'site-support-visitor-v1',
    JSON.stringify({
      visitorId: 'ABC123',
      accessToken: token,
      expiresAt: Date.now() + 60 * 60 * 1000,
    }),
  );
}

function resetState() {
  cacheEntries.clear();
  fetchCalls.length = 0;
  currentSubscription = makeSubscription('https://push.example/one', publicKeyOne);
  configKey = publicKeyOneBase64;
  unsubscribeCount = 0;
  resetIdentity();
}

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    Notification: { permission: 'granted' },
    PushManager: function PushManager() {},
    localStorage,
  },
});
Object.defineProperty(globalThis, 'Notification', {
  configurable: true,
  value: window.Notification,
});
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    serviceWorker: {
      ready: Promise.resolve({
        pushManager: {
          async getSubscription() {
            return currentSubscription;
          },
          async subscribe({ applicationServerKey }) {
            currentSubscription = makeSubscription(
              'https://push.example/recreated',
              applicationServerKey,
            );
            return currentSubscription;
          },
        },
      }),
    },
  },
});
Object.defineProperty(globalThis, 'caches', {
  configurable: true,
  value: { open: async () => cache },
});
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  value: async (input) => {
    const url = String(input);
    fetchCalls.push(url);
    if (url === '/api/public/storefront/support/connections') {
      return new Response(
        JSON.stringify({
          connections: [
            {
              id: 'connection-1',
              clientApiUrl: 'https://support.example/client/v1',
              realtimeUrl: 'wss://support.example/client/v1/realtime',
              protocolVersion: 'v1',
            },
          ],
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    }
    if (url.endsWith('/push/config')) {
      return new Response(
        JSON.stringify({ enabled: true, applicationServerKey: configKey }),
        { headers: { 'content-type': 'application/json' } },
      );
    }
    if (url.endsWith('/push/subscriptions')) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  },
});

const { syncSupportPushSubscription } = await import('../src/support-push.ts');

function callsEndingWith(suffix) {
  return fetchCalls.filter((url) => url.endsWith(suffix));
}

test('visitor push sync deduplicates unchanged bindings and repairs changed state', async (t) => {
  resetState();

  await t.test(
    'unchanged subscription does not repeat config or registration',
    async () => {
      await Promise.all([
        syncSupportPushSubscription('connection-1:conversation-1'),
        syncSupportPushSubscription('connection-1:conversation-1'),
      ]);
      await syncSupportPushSubscription('connection-1:conversation-1');

      assert.equal(callsEndingWith('/push/config').length, 1);
      assert.equal(callsEndingWith('/push/subscriptions').length, 1);
    },
  );

  await t.test('endpoint change rebinds the subscription', async () => {
    currentSubscription = makeSubscription('https://push.example/two', publicKeyOne);
    await syncSupportPushSubscription('connection-1:conversation-1');

    assert.equal(callsEndingWith('/push/config').length, 2);
    assert.equal(callsEndingWith('/push/subscriptions').length, 2);
  });

  await t.test('application server key change recreates and rebinds', async () => {
    configKey = publicKeyTwoBase64;
    currentSubscription = makeSubscription('https://push.example/two', publicKeyOne);
    const cachedContext = JSON.parse(
      await (await cache.match('/__support-push-context__/active')).text(),
    );
    cachedContext.applicationServerKey = publicKeyTwoBase64;
    cachedContext.updatedAt = Date.now();
    await cache.put('/__support-push-context__/active', makeCacheResponse(cachedContext));
    await syncSupportPushSubscription('connection-1:conversation-1');

    assert.equal(callsEndingWith('/push/config').length, 3);
    assert.equal(callsEndingWith('/push/subscriptions').length, 3);
    assert.equal(unsubscribeCount, 1);
    assert.deepEqual(
      [...new Uint8Array(currentSubscription.options.applicationServerKey)],
      [...new Uint8Array(publicKeyTwo)],
    );
  });

  await t.test(
    'conversation and visitor token changes cannot reuse the old binding',
    async () => {
      await syncSupportPushSubscription('connection-1:conversation-2');
      assert.equal(callsEndingWith('/push/subscriptions').length, 4);

      resetIdentity('b'.repeat(32));
      await syncSupportPushSubscription('connection-1:conversation-2');
      assert.equal(callsEndingWith('/push/subscriptions').length, 5);
    },
  );

  await t.test('invalid local state self-recovers', async () => {
    cacheEntries.set(
      '/__support-push-context__/active',
      makeCacheResponse({ invalid: true }),
    );
    await syncSupportPushSubscription('connection-1:conversation-2');

    assert.equal(callsEndingWith('/push/config').length, 6);
    assert.equal(callsEndingWith('/push/subscriptions').length, 6);
  });

  await t.test('expired local state self-recovers', async () => {
    const cachedContext = JSON.parse(
      await (await cache.match('/__support-push-context__/active')).text(),
    );
    cachedContext.updatedAt = Date.now() - 24 * 60 * 60 * 1000 - 1;
    await cache.put('/__support-push-context__/active', makeCacheResponse(cachedContext));
    await syncSupportPushSubscription('connection-1:conversation-2');

    assert.equal(callsEndingWith('/push/config').length, 7);
    assert.equal(callsEndingWith('/push/subscriptions').length, 7);
  });
});
