const CACHE_NAME = 'storefront-runtime-v2';
const APP_SHELL_URL = '/';
const SUPPORT_PUSH_CACHE = 'storefront-support-push-v1';
const SUPPORT_PUSH_CONTEXT_URL = '/__support-push-context__/active';
const STATIC_DESTINATIONS = new Set(['script', 'style', 'font', 'image']);
const RETAINED_CACHES = new Set([CACHE_NAME, SUPPORT_PUSH_CACHE]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(APP_SHELL_URL))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !RETAINED_CACHES.has(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('push', (event) => {
  event.waitUntil(handleSupportPush());
});

async function handleSupportPush() {
  if (await hasVisibleStorefrontWindow()) return;
  await showSupportPushNotification();
}

async function hasVisibleStorefrontWindow() {
  try {
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    return windows.some((client) => {
      try {
        return (
          new URL(client.url).origin === self.location.origin &&
          client.visibilityState === 'visible'
        );
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = safeNotificationTarget(event.notification.data?.url);
  event.waitUntil(openNotificationTarget(target));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/public/') ||
    url.pathname.startsWith('/go/')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL_URL, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(APP_SHELL_URL)) || Response.error()),
    );
    return;
  }

  if (!STATIC_DESTINATIONS.has(request.destination)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
      return cached || network;
    }),
  );
});

async function showSupportPushNotification() {
  let title = 'Messages';
  let body = 'New message';
  let target = '/messages/';
  let tag = 'support-message';
  let unreadCount = 1;

  try {
    const context = await readSupportPushContext();
    if (context) {
      const conversations = await loadUnreadConversations(context);
      unreadCount = conversations.reduce(
        (total, conversation) => total + positiveInteger(conversation.unreadCount),
        0,
      );
      const latest = conversations[0];
      if (latest) {
        title =
          stringValue(latest.agentName) || stringValue(latest.productTitle) || title;
        body = stringValue(latest.lastMessage) || body;
        if (stringValue(latest.id)) {
          const wrapped = `${context.connectionId}:${encodeURIComponent(latest.id)}`;
          target = `/messages/${encodeURIComponent(wrapped)}/`;
          tag = `support-message:${context.connectionId}:${latest.id}`;
        }
      }
    }
  } catch {
    // A push must remain user-visible even when the remote inbox cannot be refreshed.
  }

  await Promise.all([
    syncAppBadge(unreadCount),
    self.registration.showNotification(title, {
      body,
      icon: '/api/public/pwa/icon/192',
      badge: '/api/public/pwa/icon/192',
      tag,
      renotify: true,
      data: { url: target },
    }),
  ]);
}

async function readSupportPushContext() {
  const cache = await caches.open(SUPPORT_PUSH_CACHE);
  const response = await cache.match(SUPPORT_PUSH_CONTEXT_URL);
  if (!response) return null;
  const value = await response.json();
  if (
    !value ||
    typeof value !== 'object' ||
    typeof value.connectionId !== 'string' ||
    typeof value.clientApiUrl !== 'string' ||
    typeof value.visitorId !== 'string'
  ) {
    return null;
  }
  return value;
}

async function loadUnreadConversations(context) {
  const url = new URL(`${context.clientApiUrl}/conversations`);
  url.searchParams.set('visitorId', context.visitorId);
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'omit',
    headers: { Accept: 'application/json' },
    mode: 'cors',
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Support inbox unavailable');
  const body = await response.json();
  if (!body || !Array.isArray(body.conversations)) return [];
  return body.conversations.filter(
    (conversation) =>
      conversation &&
      typeof conversation === 'object' &&
      positiveInteger(conversation.unreadCount) > 0,
  );
}

async function syncAppBadge(unreadCount) {
  try {
    if (unreadCount > 0 && typeof self.navigator?.setAppBadge === 'function') {
      await self.navigator.setAppBadge(unreadCount);
      return;
    }
    if (unreadCount <= 0 && typeof self.navigator?.clearAppBadge === 'function') {
      await self.navigator.clearAppBadge();
    }
  } catch {
    // Badging is optional.
  }
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function safeNotificationTarget(value) {
  if (typeof value !== 'string') return '/messages/';
  try {
    const target = new URL(value, self.location.origin);
    return target.origin === self.location.origin
      ? `${target.pathname}${target.search}${target.hash}`
      : '/messages/';
  } catch {
    return '/messages/';
  }
}

async function openNotificationTarget(path) {
  const targetUrl = new URL(path, self.location.origin).href;
  const windows = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  const current = windows.find(
    (client) => new URL(client.url).origin === self.location.origin,
  );
  if (current) {
    if ('navigate' in current) await current.navigate(targetUrl);
    return current.focus();
  }
  return self.clients.openWindow(targetUrl);
}
