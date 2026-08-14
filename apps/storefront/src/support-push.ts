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

async function resolveConversationConnection(
  conversationRef: string,
): Promise<{
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

async function readPushConfig(
  connection: PublicSupportConnection,
): Promise<Uint8Array> {
  const response = await fetch(`${connection.clientApiUrl}/push/config`, {
    cache: 'no-store',
    credentials: 'omit',
    headers: { Accept: 'application/json' },
    mode: 'cors',
    redirect: 'error',
  });
  if (!response.ok) throw new Error('SUPPORT_PUSH_CONFIG_FAILED');
  const body = (await response.json()) as PushConfigEnvelope;
  if (body.enabled !== true || typeof body.applicationServerKey !== 'string') {
    throw new Error('SUPPORT_PUSH_UNAVAILABLE');
  }
  return base64UrlToBytes(body.applicationServerKey);
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/gu, '+').replace(/_/gu, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function sameApplicationServerKey(
  subscription: PushSubscription,
  expected: Uint8Array,
): boolean {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const bytes = new Uint8Array(current);
  if (bytes.length !== expected.length) return false;
  return bytes.every((value, index) => value === expected[index]);
}

async function registerSubscription(
  conversationRef: string,
): Promise<PushSubscription> {
  const { connection, remoteConversationId } =
    await resolveConversationConnection(conversationRef);
  const applicationServerKey = await readPushConfig(connection);
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameApplicationServerKey(subscription, applicationServerKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({
    applicationServerKey,
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
  });
  return subscription;
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
  if (!supportsPush()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission !== 'granted') return 'prompt';
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
