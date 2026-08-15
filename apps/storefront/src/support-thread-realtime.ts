import { buildSupportConversationWebSocketUrl } from './support-gateway';

export type SupportTypingChannel = {
  setTyping(active: boolean): void;
  close(): void;
};

const RECONNECT_DELAYS_MS = [750, 1_500, 3_000, 6_000, 10_000];
const HEARTBEAT_MS = 25_000;

function reconnectDelay(attempt: number): number {
  return RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)] ?? 10_000;
}

export async function openSupportTypingChannel(
  conversationRef: string,
  onAgentTyping: (active: boolean) => void,
): Promise<SupportTypingChannel> {
  const url = await buildSupportConversationWebSocketUrl(conversationRef);
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let heartbeatTimer: number | null = null;
  let reconnectAttempt = 0;
  let stopped = false;
  let desiredTyping = false;
  let sentTyping = false;

  const clearTimers = () => {
    if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
    if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
    reconnectTimer = null;
    heartbeatTimer = null;
  };

  const transmitTyping = (active: boolean) => {
    desiredTyping = active;
    if (!socket || socket.readyState !== WebSocket.OPEN || sentTyping === active) return;
    try {
      socket.send(JSON.stringify({ type: 'typing', active }));
      sentTyping = active;
    } catch {
      socket.close();
    }
  };

  const connect = () => {
    if (stopped) return;
    try {
      const nextSocket = new WebSocket(url);
      socket = nextSocket;
      nextSocket.addEventListener('open', () => {
        if (stopped || socket !== nextSocket) return;
        reconnectAttempt = 0;
        sentTyping = false;
        if (desiredTyping) transmitTyping(true);
        heartbeatTimer = window.setInterval(() => {
          if (socket !== nextSocket || nextSocket.readyState !== WebSocket.OPEN) return;
          try {
            nextSocket.send('ping');
          } catch {
            nextSocket.close();
          }
        }, HEARTBEAT_MS);
      });
      nextSocket.addEventListener('message', (event) => {
        if (stopped || socket !== nextSocket) return;
        try {
          const value = JSON.parse(String(event.data)) as {
            type?: unknown;
            actor?: unknown;
            active?: unknown;
          };
          if (
            value.type === 'typing' &&
            value.actor === 'agent' &&
            typeof value.active === 'boolean'
          ) {
            onAgentTyping(value.active);
          }
        } catch {
          // Invalid realtime frames are ignored.
        }
      });
      nextSocket.addEventListener('close', () => {
        if (socket !== nextSocket) return;
        if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        socket = null;
        sentTyping = false;
        onAgentTyping(false);
        if (stopped) return;
        const delay = reconnectDelay(reconnectAttempt);
        reconnectAttempt += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      });
      nextSocket.addEventListener('error', () => nextSocket.close());
    } catch {
      const delay =
        RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
      reconnectAttempt += 1;
      reconnectTimer = window.setTimeout(connect, delay);
    }
  };

  connect();

  return {
    setTyping: transmitTyping,
    close() {
      if (stopped) return;
      if (socket?.readyState === WebSocket.OPEN && sentTyping) {
        try {
          socket.send(JSON.stringify({ type: 'typing', active: false }));
        } catch {
          // The socket may already be closing.
        }
      }
      stopped = true;
      clearTimers();
      socket?.close();
      socket = null;
      onAgentTyping(false);
    },
  };
}
