import {
  loadPublicSupportConnections,
  type PublicSupportConnection,
} from './support-gateway';
import { getSupportVisitorIdentity } from './support-identity';

export type SupportPushState = 'unsupported' | 'prompt' | 'enabled' | 'blocked';

type PushContext = {
  connectionId: string;
  clientApiUrl: string;
  visitorId: string;
  remoteConversationId: string;
  visitorTokenFingerprint: string;
  endpoint: string;
  applicationServerKey: string;
  updatedAt: number;
};

type PushConfigEnvelope = {
  enabled?: boolean;
  applicationServerKey?: string;
};

type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

const SUPPORT_PUSH_CACHE = 'storefront-support-push-v1';
const SUPPORT_PUSH_CONTEXT_URL = '/__support-push-context__/active';
const SUPPORT_PUSH_CONTEXT_TTL_MS = 24 * 60 * 60 * 1000;
const pushSyncRequests = new Map<string, Promise<SupportPushState>>();

function supportsPush(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

function parseConversationRef(
  value: string,
): { connectionId: string; remoteConversationId: string } | null {
  const separator = value.indexOf(':');
  if (separator < 1 || separator === value.length - 1) return null;
  const connectionId = value.slice(0, separator);
  try {
    const remoteConversationId = decodeURIComponent(value.slice(separator + 1));
    return remoteConversationId ? { connectionId, remoteConversationId } : null;
  } catch {
    return null;
  }
}

async function resolveConversationConnection(conversationRef: string): Promise<{
  connection: PublicSupportConnection;
  remoteConversationId: string;
}> {
  const parsed = parseConversationRef(conversationRef);
  if (!parsed) throw new Error('INVALID_SUPPORT_CONVERSATION');
  const connections = await loadPublicSupportConnections();
  const connection = connections.find((item) => item.id === parsed.connectionId);
  if (!connection) throw new Error('SUPPORT_CONNECTION_NOT_FOUND');
  return { connection, remoteConversationId: parsed.remoteConversationId };
}

async function readPushConfig(connection: PublicSupportConnection): Promise<{
  applicationServerKey: ArrayBuffer;
  encodedApplicationServerKey: string;
}> {
  const response = await fetch(`${connection.clientApiUrl}/push/config`, {
    cache: 'no-store',
    credentials: 'omit',
    headers: { Accept: 'application/json' },
    mode: 'cors',
    redirect: 'error',
  });
  if (!response.ok) throw new Error('SUPPORT_PUSH_CONFIG_FAILED');
  const body = (await response.json()) as PushConfigEnvelope;
  if (
    body.enabled !== true ||
    typeof body.applicationServerKey !== 'string' ||
    !body.applicationServerKey
  ) {
    throw new Error('SUPPORT_PUSH_UNAVAILABLE');
  }
  const encodedApplicationServerKey = body.applicationServerKey
    .replace(/=+$/u, '')
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_');
  return {
    applicationServerKey: base64UrlToArrayBuffer(encodedApplicationServerKey),
    encodedApplicationServerKey,
  };
}

function base64UrlToArrayBuffer(value: string): ArrayBuffer {
  const normalized = value.replace(/-/gu, '+').replace(/_/gu, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function sameApplicationServerKey(
  subscription: PushSubscription,
  expected: ArrayBuffer,
): boolean {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const bytes = new Uint8Array(current);
  const expectedBytes = new Uint8Array(expected);
  if (bytes.length !== expectedBytes.length) return false;
  return bytes.every((value, index) => value === expectedBytes[index]);
}

async function registerSubscription(conversationRef: string): Promise<PushSubscription> {
  const { connection, remoteConversationId } =
    await resolveConversationConnection(conversationRef);
  const pushConfig = await readPushConfig(connection);
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (
    subscription &&
    !sameApplicationServerKey(subscription, pushConfig.applicationServerKey)
  ) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({
    applicationServerKey: pushConfig.applicationServerKey,
    userVisibleOnly: true,
  });

  const identity = getSupportVisitorIdentity();
  const response = await fetch(`${connection.clientApiUrl}/push/subscriptions`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    mode: 'cors',
    redirect: 'error',
    body: JSON.stringify({
      visitorId: identity.visitorId,
      ...(identity.accessToken ? { visitorToken: identity.accessToken } : {}),
      conversationId: remoteConversationId,
      subscription: {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
      },
    }),
  });
  if (!response.ok) throw new Error('SUPPORT_PUSH_SUBSCRIPTION_FAILED');

  await savePushContext({
    connectionId: connection.id,
    clientApiUrl: connection.clientApiUrl,
    visitorId: identity.visitorId,
    remoteConversationId,
    visitorTokenFingerprint: await fingerprintVisitorToken(identity.accessToken),
    endpoint: subscription.endpoint,
    applicationServerKey: pushConfig.encodedApplicationServerKey,
    updatedAt: Date.now(),
  });
  return subscription;
}

async function fingerprintVisitorToken(token: string | null): Promise<string> {
  const bytes = new TextEncoder().encode(token ?? '');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function readPushContext(): Promise<PushContext | null> {
  try {
    const cache = await caches.open(SUPPORT_PUSH_CACHE);
    const response = await cache.match(SUPPORT_PUSH_CONTEXT_URL);
    if (!response) return null;
    const value = (await response.json()) as Partial<PushContext>;
    if (
      typeof value.connectionId !== 'string' ||
      typeof value.clientApiUrl !== 'string' ||
      typeof value.visitorId !== 'string' ||
      typeof value.remoteConversationId !== 'string' ||
      typeof value.visitorTokenFingerprint !== 'string' ||
      typeof value.endpoint !== 'string' ||
      !value.endpoint.startsWith('https://') ||
      typeof value.applicationServerKey !== 'string' ||
      !value.applicationServerKey ||
      typeof value.updatedAt !== 'number' ||
      !Number.isFinite(value.updatedAt) ||
      value.updatedAt < Date.now() - SUPPORT_PUSH_CONTEXT_TTL_MS
    ) {
      return null;
    }
    return value as PushContext;
  } catch {
    return null;
  }
}

function samePushBinding(
  context: PushContext,
  target: {
    connection: PublicSupportConnection;
    remoteConversationId: string;
  },
  visitorId: string,
  visitorTokenFingerprint: string,
  subscription: PushSubscription,
): boolean {
  try {
    return (
      context.connectionId === target.connection.id &&
      context.clientApiUrl === target.connection.clientApiUrl &&
      context.remoteConversationId === target.remoteConversationId &&
      context.visitorId === visitorId &&
      context.visitorTokenFingerprint === visitorTokenFingerprint &&
      context.endpoint === subscription.endpoint &&
      sameApplicationServerKey(
        subscription,
        base64UrlToArrayBuffer(context.applicationServerKey),
      )
    );
  } catch {
    return false;
  }
}

async function savePushContext(context: PushContext): Promise<void> {
  const cache = await caches.open(SUPPORT_PUSH_CACHE);
  await cache.put(
    SUPPORT_PUSH_CONTEXT_URL,
    new Response(JSON.stringify(context), {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

export async function readSupportPushState(): Promise<SupportPushState> {
  if (!supportsPush()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission !== 'granted') return 'prompt';
  const registration = await navigator.serviceWorker.ready;
  return (await registration.pushManager.getSubscription()) ? 'enabled' : 'prompt';
}

export async function enableSupportPush(
  conversationRef: string,
): Promise<SupportPushState> {
  if (!supportsPush()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'blocked';
  if (permission !== 'granted') return 'prompt';
  await registerSubscription(conversationRef);
  return 'enabled';
}

export async function syncSupportPushSubscription(
  conversationRef: string,
): Promise<SupportPushState> {
  const pending = pushSyncRequests.get(conversationRef);
  if (pending) return pending;
  const request = syncSupportPushSubscriptionInternal(conversationRef);
  pushSyncRequests.set(conversationRef, request);
  void request.then(
    () => pushSyncRequests.delete(conversationRef),
    () => pushSyncRequests.delete(conversationRef),
  );
  return request;
}

async function syncSupportPushSubscriptionInternal(
  conversationRef: string,
): Promise<SupportPushState> {
  if (!supportsPush()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission !== 'granted') return 'prompt';
  const target = await resolveConversationConnection(conversationRef);
  const identity = getSupportVisitorIdentity();
  const visitorTokenFingerprint = await fingerprintVisitorToken(identity.accessToken);
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  const context = await readPushContext();
  if (
    subscription &&
    context &&
    samePushBinding(
      context,
      target,
      identity.visitorId,
      visitorTokenFingerprint,
      subscription,
    )
  ) {
    return 'enabled';
  }
  await registerSubscription(conversationRef);
  return 'enabled';
}

export async function syncSupportAppBadge(unreadCount: number): Promise<void> {
  if (typeof navigator === 'undefined') return;
  const badgeNavigator = navigator as BadgeNavigator;
  try {
    if (unreadCount > 0 && badgeNavigator.setAppBadge) {
      await badgeNavigator.setAppBadge(unreadCount);
      return;
    }
    if (unreadCount <= 0 && badgeNavigator.clearAppBadge) {
      await badgeNavigator.clearAppBadge();
    }
  } catch {
    // Badge support is optional and must never interfere with Messages.
  }
}

export const SUPPORT_PUSH_CACHE_NAME = SUPPORT_PUSH_CACHE;
export const SUPPORT_PUSH_CONTEXT_PATH = SUPPORT_PUSH_CONTEXT_URL;
