import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { URL } from 'node:url';
import test from 'node:test';

function createServiceWorkerHarness({
  windows = [],
  context = null,
  fetchError = false,
} = {}) {
  const listeners = new Map();
  const fetchCalls = [];
  const notifications = [];
  const badges = [];
  const cacheResponse = context
    ? new Response(JSON.stringify(context), {
        headers: { 'content-type': 'application/json' },
      })
    : null;
  const cache = {
    async match() {
      return cacheResponse?.clone();
    },
  };
  const self = {
    location: { origin: 'https://storefront.example' },
    navigator: {
      async setAppBadge(value) {
        badges.push(['set', value]);
      },
      async clearAppBadge() {
        badges.push(['clear']);
      },
    },
    registration: {
      async showNotification(title, options) {
        notifications.push({ title, options });
      },
    },
    clients: {
      async matchAll() {
        return windows;
      },
      async openWindow() {
        return null;
      },
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    skipWaiting() {},
  };
  const contextObject = vm.createContext({
    URL,
    Promise,
    Response,
    console,
    fetch: async (input) => {
      const url = String(input);
      fetchCalls.push(url);
      if (fetchError) throw new Error('network unavailable');
      return new Response(
        JSON.stringify({
          conversations: [
            {
              id: 'conversation-1',
              agentName: 'Agent One',
              productTitle: 'Product One',
              lastMessage: 'Hello from support',
              unreadCount: 2,
            },
          ],
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    },
    caches: { open: async () => cache },
    self,
  });
  vm.runInContext(
    readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'),
    contextObject,
  );

  return {
    fetchCalls,
    notifications,
    badges,
    async dispatchPush() {
      let promise;
      listeners.get('push')({
        waitUntil(value) {
          promise = value;
        },
      });
      await promise;
    },
  };
}

const context = {
  connectionId: 'connection-1',
  clientApiUrl: 'https://support.example/client/v1',
  visitorId: 'ABC123',
};

test('foreground visible storefront window skips support conversations fetch and notification', async () => {
  const harness = createServiceWorkerHarness({
    windows: [
      {
        url: 'https://storefront.example/messages/',
        visibilityState: 'visible',
      },
    ],
    context,
  });

  await harness.dispatchPush();

  assert.equal(harness.fetchCalls.length, 0);
  assert.equal(harness.notifications.length, 0);
  assert.deepEqual(harness.badges, []);
});

test('background support push keeps the existing unread target and badge behavior', async () => {
  const harness = createServiceWorkerHarness({ context });

  await harness.dispatchPush();

  assert.equal(harness.fetchCalls.length, 1);
  assert.equal(
    harness.fetchCalls[0],
    'https://support.example/client/v1/conversations?visitorId=ABC123',
  );
  assert.equal(harness.notifications.length, 1);
  assert.equal(harness.notifications[0].title, 'Agent One');
  assert.equal(harness.notifications[0].options.body, 'Hello from support');
  assert.equal(
    harness.notifications[0].options.data.url,
    '/messages/connection-1%3Aconversation-1/',
  );
  assert.deepEqual(harness.badges, [['set', 2]]);
});

test('missing push context and API failures still produce a user-visible fallback', async (t) => {
  await t.test('missing context', async () => {
    const harness = createServiceWorkerHarness();
    await harness.dispatchPush();

    assert.equal(harness.fetchCalls.length, 0);
    assert.equal(harness.notifications.length, 1);
    assert.equal(harness.notifications[0].title, 'Messages');
  });

  await t.test('API failure', async () => {
    const harness = createServiceWorkerHarness({ context, fetchError: true });
    await harness.dispatchPush();

    assert.equal(harness.fetchCalls.length, 1);
    assert.equal(harness.notifications.length, 1);
    assert.equal(harness.notifications[0].title, 'Messages');
    assert.deepEqual(harness.badges, [['set', 1]]);
  });
});
