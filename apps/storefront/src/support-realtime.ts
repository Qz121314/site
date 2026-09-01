import type {
  SupportConversationSummary,
  SupportMessage,
  SupportMessageAttachment,
} from './support-contract';
import {
  normalizeSupportLinkValue,
  normalizeSupportPhoneValue,
} from './support-attachment-safety';
import {
  buildSupportWebSocketUrl,
  loadPublicSupportConnections,
  resolveSupportAssetUrl,
  wrapSupportConversationRef,
  type PublicSupportConnection,
} from './support-gateway';
import { getSupportVisitorIdentity } from './support-identity';

export type SupportRealtimeEvent = {
  type: string;
  connectionId: string;
  conversationRef: string | null;
  conversation: SupportConversationSummary | null;
  message: SupportMessage | null;
  reader: 'agent' | 'visitor' | null;
  lastMessageId: string | null;
};

type Listener = (event: SupportRealtimeEvent) => void;

type SocketState = {
  connection: PublicSupportConnection;
  socket: WebSocket | null;
  reconnectTimer: number | null;
  heartbeatTimer: number | null;
  reconnectAttempt: number;
  lastActivityAt: number;
  openedOnce: boolean;
  stopped: boolean;
};

const SOCKET_STOP_GRACE_MS = 1_500;
const SOCKET_HEARTBEAT_MS = 25_000;
const SOCKET_STALE_MS = SOCKET_HEARTBEAT_MS * 3;
const listeners = new Set<Listener>();
const sockets = new Map<string, SocketState>();
let starting: Promise<void> | null = null;
let stopTimer: number | null = null;
let lifecycleInstalled = false;

function emit(event: SupportRealtimeEvent) {
  for (const listener of listeners) listener(event);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function parseConversation(
  connection: PublicSupportConnection,
  value: unknown,
): SupportConversationSummary | null {
  const item = isRecord(value) ? value : null;
  if (
    !item ||
    typeof item.id !== 'string' ||
    !nullableString(item.agentName) ||
    !nullableString(item.agentAvatarUrl) ||
    typeof item.productTitle !== 'string' ||
    !nullableString(item.productCoverUrl) ||
    !nullableString(item.lastMessage) ||
    !nullableString(item.lastMessageAt) ||
    typeof item.unreadCount !== 'number' ||
    !Number.isInteger(item.unreadCount) ||
    (item.status !== 'waiting' && item.status !== 'active' && item.status !== 'closed')
  ) {
    return null;
  }
  return {
    id: wrapSupportConversationRef(connection.id, item.id),
    agentName: item.agentName,
    agentAvatarUrl: resolveSupportAssetUrl(connection, item.agentAvatarUrl),
    productTitle: item.productTitle,
    productCoverUrl: item.productCoverUrl,
    lastMessage: item.lastMessage,
    lastMessageAt: item.lastMessageAt,
    unreadCount: item.unreadCount,
    status: item.status,
  };
}

function parseAttachment(
  connection: PublicSupportConnection,
  value: unknown,
): SupportMessageAttachment | null {
  const item = isRecord(value) ? value : null;
  if (!item || typeof item.id !== 'string' || !item.id) return null;
  const kind = item.kind;
  const label =
    typeof item.label === 'string' && item.label.trim()
      ? item.label.trim()
      : kind === 'image'
        ? typeof item.originalName === 'string' && item.originalName
          ? item.originalName
          : 'Image'
        : '';

  if (kind === 'phone' || kind === 'link') {
    const normalizedValue =
      kind === 'phone'
        ? normalizeSupportPhoneValue(item.value)
        : normalizeSupportLinkValue(item.value);
    if (!normalizedValue || !label) return null;
    return {
      id: item.id,
      kind,
      label,
      value: normalizedValue,
    };
  }

  if (
    kind !== 'image' ||
    typeof item.mimeType !== 'string' ||
    typeof item.byteSize !== 'number' ||
    !Number.isFinite(item.byteSize) ||
    (item.width !== null && item.width !== undefined && typeof item.width !== 'number') ||
    (item.height !== null &&
      item.height !== undefined &&
      typeof item.height !== 'number') ||
    (item.originalName !== null &&
      item.originalName !== undefined &&
      typeof item.originalName !== 'string')
  ) {
    return null;
  }
  const identity = getSupportVisitorIdentity();
  const contentUrl = new URL(
    `${connection.clientApiUrl.replace(/\/$/u, '')}/${item.source === 'snapshot' ? 'attachments' : 'media'}/${encodeURIComponent(item.id)}/content`,
  );
  contentUrl.searchParams.set('visitorId', identity.visitorId);
  if (identity.accessToken) {
    contentUrl.searchParams.set('visitorToken', identity.accessToken);
  }
  return {
    id: item.id,
    kind: 'image',
    label,
    mimeType: item.mimeType,
    byteSize: item.byteSize,
    width: typeof item.width === 'number' ? item.width : null,
    height: typeof item.height === 'number' ? item.height : null,
    originalName: typeof item.originalName === 'string' ? item.originalName : null,
    url: contentUrl.toString(),
  };
}

function parseMessage(
  connection: PublicSupportConnection,
  value: unknown,
  attachmentsValue: unknown,
  mediaValue: unknown,
): SupportMessage | null {
  const item = isRecord(value) ? value : null;
  if (
    !item ||
    typeof item.id !== 'string' ||
    (item.direction !== 'customer' && item.direction !== 'agent') ||
    typeof item.body !== 'string' ||
    typeof item.sentAt !== 'string' ||
    (item.delivery !== 'sending' &&
      item.delivery !== 'failed' &&
      item.delivery !== 'sent' &&
      item.delivery !== 'read')
  ) {
    return null;
  }

  const rawAttachments = [
    ...(Array.isArray(item.attachments) ? item.attachments : []),
    ...(Array.isArray(attachmentsValue) ? attachmentsValue : []),
    ...(mediaValue ? [mediaValue] : []),
  ];
  const attachmentsById = new Map<string, SupportMessageAttachment>();
  for (const rawAttachment of rawAttachments) {
    const attachment = parseAttachment(connection, rawAttachment);
    if (attachment) attachmentsById.set(attachment.id, attachment);
  }
  return {
    id: item.id,
    direction: item.direction,
    body: item.body,
    sentAt: item.sentAt,
    delivery: item.delivery,
    attachments: [...attachmentsById.values()],
  };
}

function emptyEvent(state: SocketState, type: string): SupportRealtimeEvent {
  return {
    type,
    connectionId: state.connection.id,
    conversationRef: null,
    conversation: null,
    message: null,
    reader: null,
    lastMessageId: null,
  };
}

function parseEvent(state: SocketState, raw: unknown): SupportRealtimeEvent | null {
  if (!isRecord(raw) || typeof raw.type !== 'string' || !raw.type.trim()) return null;
  if (raw.type === 'ready' || raw.type === 'pong') return null;
  const remoteConversationId =
    typeof raw.conversationId === 'string' ? raw.conversationId.trim() : '';
  const conversation = parseConversation(state.connection, raw.conversation);
  const conversationRef =
    conversation?.id ??
    (remoteConversationId
      ? wrapSupportConversationRef(state.connection.id, remoteConversationId)
      : null);
  return {
    type: raw.type,
    connectionId: state.connection.id,
    conversationRef,
    conversation,
    message: parseMessage(state.connection, raw.message, raw.attachments, raw.media),
    reader: raw.reader === 'agent' || raw.reader === 'visitor' ? raw.reader : null,
    lastMessageId: typeof raw.lastMessageId === 'string' ? raw.lastMessageId : null,
  };
}

function reconnectDelay(attempt: number): number {
  return Math.min(10_000, 750 * 2 ** Math.min(attempt, 4));
}

function clearHeartbeat(state: SocketState) {
  if (state.heartbeatTimer !== null && typeof window !== 'undefined') {
    window.clearInterval(state.heartbeatTimer);
  }
  state.heartbeatTimer = null;
}

function startHeartbeat(state: SocketState, socket: WebSocket) {
  if (typeof window === 'undefined') return;
  clearHeartbeat(state);
  state.heartbeatTimer = window.setInterval(() => {
    if (state.stopped || state.socket !== socket) return;
    if (socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send('ping');
    } catch {
      socket.close();
    }
  }, SOCKET_HEARTBEAT_MS);
}

function scheduleReconnect(state: SocketState) {
  if (state.stopped || listeners.size === 0 || typeof window === 'undefined') return;
  if (state.reconnectTimer !== null) window.clearTimeout(state.reconnectTimer);
  const delay = reconnectDelay(state.reconnectAttempt);
  state.reconnectAttempt += 1;
  state.reconnectTimer = window.setTimeout(() => {
    state.reconnectTimer = null;
    openSocket(state);
  }, delay);
}

function openSocket(state: SocketState) {
  if (state.stopped || listeners.size === 0 || typeof WebSocket === 'undefined') return;
  if (
    state.socket &&
    (state.socket.readyState === WebSocket.OPEN ||
      state.socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }
  try {
    const socket = new WebSocket(buildSupportWebSocketUrl(state.connection));
    state.socket = socket;
    socket.addEventListener('open', () => {
      if (state.socket !== socket) return;
      const recovered = state.openedOnce;
      state.openedOnce = true;
      state.reconnectAttempt = 0;
      state.lastActivityAt = Date.now();
      startHeartbeat(state, socket);
      emit(emptyEvent(state, recovered ? 'realtime.recovered' : 'realtime.connected'));
    });
    socket.addEventListener('message', (event) => {
      if (state.socket !== socket) return;
      state.lastActivityAt = Date.now();
      try {
        const parsed = parseEvent(state, JSON.parse(String(event.data)) as unknown);
        if (parsed) emit(parsed);
      } catch {
        // Invalid frames are ignored; a reconnect is the REST recovery boundary.
      }
    });
    socket.addEventListener('close', () => {
      if (state.socket !== socket) return;
      clearHeartbeat(state);
      state.socket = null;
      scheduleReconnect(state);
    });
    socket.addEventListener('error', () => socket.close());
  } catch {
    state.socket = null;
    scheduleReconnect(state);
  }
}

async function startSockets() {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
  const connections = await loadPublicSupportConnections();
  if (listeners.size === 0) return;
  const activeIds = new Set(connections.map((connection) => connection.id));

  for (const [id, state] of sockets) {
    if (activeIds.has(id)) continue;
    state.stopped = true;
    clearHeartbeat(state);
    state.socket?.close();
    if (state.reconnectTimer !== null) window.clearTimeout(state.reconnectTimer);
    sockets.delete(id);
  }

  for (const connection of connections) {
    const existing = sockets.get(connection.id);
    if (existing) {
      existing.connection = connection;
      existing.stopped = false;
      openSocket(existing);
      continue;
    }
    const state: SocketState = {
      connection,
      socket: null,
      reconnectTimer: null,
      heartbeatTimer: null,
      reconnectAttempt: 0,
      lastActivityAt: 0,
      openedOnce: false,
      stopped: false,
    };
    sockets.set(connection.id, state);
    openSocket(state);
  }
}

function ensureStarted() {
  if (starting) return;
  starting = startSockets()
    .catch(() => undefined)
    .finally(() => {
      starting = null;
    });
}

function stopSockets() {
  if (typeof window === 'undefined') return;
  for (const state of sockets.values()) {
    state.stopped = true;
    clearHeartbeat(state);
    state.socket?.close();
    state.socket = null;
    if (state.reconnectTimer !== null) window.clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }
  sockets.clear();
}

function cancelScheduledStop() {
  if (stopTimer === null || typeof window === 'undefined') return;
  window.clearTimeout(stopTimer);
  stopTimer = null;
}

function scheduleStopSockets() {
  if (typeof window === 'undefined') return;
  cancelScheduledStop();
  stopTimer = window.setTimeout(() => {
    stopTimer = null;
    if (listeners.size === 0) stopSockets();
  }, SOCKET_STOP_GRACE_MS);
}

function recoverSockets() {
  if (listeners.size === 0 || typeof WebSocket === 'undefined') return;
  const now = Date.now();
  for (const state of sockets.values()) {
    state.stopped = false;
    const socket = state.socket;
    if (!socket) {
      openSocket(state);
      continue;
    }
    if (
      socket.readyState === WebSocket.CLOSED ||
      socket.readyState === WebSocket.CLOSING ||
      (socket.readyState === WebSocket.OPEN &&
        state.lastActivityAt > 0 &&
        now - state.lastActivityAt > SOCKET_STALE_MS)
    ) {
      clearHeartbeat(state);
      state.socket = null;
      try {
        socket.close();
      } catch {
        // Reopening below performs recovery.
      }
      openSocket(state);
    }
  }
  if (sockets.size === 0) ensureStarted();
}

function installLifecycleRecovery() {
  if (lifecycleInstalled || typeof window === 'undefined') return;
  lifecycleInstalled = true;
  window.addEventListener('online', recoverSockets);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') recoverSockets();
  });
}

export function subscribeSupportRealtime(listener: Listener): () => void {
  listeners.add(listener);
  cancelScheduledStop();
  installLifecycleRecovery();
  ensureStarted();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) scheduleStopSockets();
  };
}
