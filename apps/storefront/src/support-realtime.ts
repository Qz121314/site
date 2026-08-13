import {
  buildSupportWebSocketUrl,
  loadPublicSupportConnections,
  wrapSupportConversationRef,
  type PublicSupportConnection,
} from './support-gateway';

export type SupportRealtimeEvent = {
  type: string;
  connectionId: string;
  conversationRef: string | null;
};

type Listener = (event: SupportRealtimeEvent) => void;

type SocketState = {
  connection: PublicSupportConnection;
  socket: WebSocket | null;
  reconnectTimer: number | null;
  heartbeatTimer: number | null;
  reconnectAttempt: number;
  lastActivityAt: number;
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

function parseEvent(connectionId: string, raw: unknown): SupportRealtimeEvent | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.type !== 'string' || !record.type.trim()) return null;
  if (record.type === 'ready' || record.type === 'pong') return null;
  const remoteConversationId =
    typeof record.conversationId === 'string' ? record.conversationId.trim() : '';
  return {
    type: record.type,
    connectionId,
    conversationRef: remoteConversationId
      ? wrapSupportConversationRef(connectionId, remoteConversationId)
      : null,
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
      state.reconnectAttempt = 0;
      state.lastActivityAt = Date.now();
      startHeartbeat(state, socket);
      emit({
        type: 'realtime.connected',
        connectionId: state.connection.id,
        conversationRef: null,
      });
    });
    socket.addEventListener('message', (event) => {
      if (state.socket !== socket) return;
      state.lastActivityAt = Date.now();
      try {
        const parsed = parseEvent(
          state.connection.id,
          JSON.parse(String(event.data)) as unknown,
        );
        if (parsed) emit(parsed);
      } catch {
        // Ignore malformed realtime frames; REST remains the recovery source.
      }
    });
    socket.addEventListener('close', () => {
      if (state.socket !== socket) return;
      clearHeartbeat(state);
      state.socket = null;
      scheduleReconnect(state);
    });
    socket.addEventListener('error', () => {
      socket.close();
    });
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
        // Reopening below is the recovery path.
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
