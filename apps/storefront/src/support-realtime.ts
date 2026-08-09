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
  reconnectAttempt: number;
  stopped: boolean;
};

const listeners = new Set<Listener>();
const sockets = new Map<string, SocketState>();
let starting: Promise<void> | null = null;

function emit(event: SupportRealtimeEvent) {
  for (const listener of listeners) listener(event);
}

function parseEvent(connectionId: string, raw: unknown): SupportRealtimeEvent | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.type !== 'string' || !record.type.trim()) return null;
  const remoteConversationId = typeof record.conversationId === 'string'
    ? record.conversationId.trim()
    : '';
  return {
    type: record.type,
    connectionId,
    conversationRef: remoteConversationId
      ? wrapSupportConversationRef(connectionId, remoteConversationId)
      : null,
  };
}

function reconnectDelay(attempt: number): number {
  return Math.min(10_000, 750 * (2 ** Math.min(attempt, 4)));
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
  try {
    const socket = new WebSocket(buildSupportWebSocketUrl(state.connection));
    state.socket = socket;
    socket.addEventListener('open', () => {
      state.reconnectAttempt = 0;
    });
    socket.addEventListener('message', (event) => {
      try {
        const parsed = parseEvent(state.connection.id, JSON.parse(String(event.data)) as unknown);
        if (parsed) emit(parsed);
      } catch {
        // Ignore malformed realtime frames; REST remains the recovery source.
      }
    });
    socket.addEventListener('close', () => {
      if (state.socket === socket) state.socket = null;
      scheduleReconnect(state);
    });
    socket.addEventListener('error', () => {
      socket.close();
    });
  } catch {
    scheduleReconnect(state);
  }
}

async function startSockets() {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
  const connections = await loadPublicSupportConnections();
  const activeIds = new Set(connections.map((connection) => connection.id));

  for (const [id, state] of sockets) {
    if (activeIds.has(id)) continue;
    state.stopped = true;
    state.socket?.close();
    if (state.reconnectTimer !== null) window.clearTimeout(state.reconnectTimer);
    sockets.delete(id);
  }

  for (const connection of connections) {
    const existing = sockets.get(connection.id);
    if (existing) {
      existing.connection = connection;
      existing.stopped = false;
      if (!existing.socket) openSocket(existing);
      continue;
    }
    const state: SocketState = {
      connection,
      socket: null,
      reconnectTimer: null,
      reconnectAttempt: 0,
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
    state.socket?.close();
    state.socket = null;
    if (state.reconnectTimer !== null) window.clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }
  sockets.clear();
}

export function subscribeSupportRealtime(listener: Listener): () => void {
  listeners.add(listener);
  ensureStarted();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopSockets();
  };
}
