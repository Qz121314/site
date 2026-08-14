from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


# ---------------------------------------------------------------------------
# WebSocket payload parsing: realtime events now carry enough state to update
# React Query caches directly. REST remains initialization/recovery only.
# ---------------------------------------------------------------------------
write(
    'apps/storefront/src/support-realtime.ts',
    """import type {
  SupportConversationSummary,
  SupportImageAttachment,
  SupportMessage,
} from './support-contract';
import {
  buildSupportWebSocketUrl,
  loadPublicSupportConnections,
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
  connectionId: string,
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
    id: wrapSupportConversationRef(connectionId, item.id),
    agentName: item.agentName,
    agentAvatarUrl: item.agentAvatarUrl,
    productTitle: item.productTitle,
    productCoverUrl: item.productCoverUrl,
    lastMessage: item.lastMessage,
    lastMessageAt: item.lastMessageAt,
    unreadCount: item.unreadCount,
    status: item.status,
  };
}

function parseMedia(
  connection: PublicSupportConnection,
  value: unknown,
): { messageId: string; attachment: SupportImageAttachment } | null {
  const item = isRecord(value) ? value : null;
  if (
    !item ||
    typeof item.messageId !== 'string' ||
    typeof item.id !== 'string' ||
    item.kind !== 'image' ||
    typeof item.mimeType !== 'string' ||
    typeof item.byteSize !== 'number' ||
    !Number.isFinite(item.byteSize) ||
    (item.width !== null && typeof item.width !== 'number') ||
    (item.height !== null && typeof item.height !== 'number') ||
    !nullableString(item.originalName)
  ) {
    return null;
  }
  const identity = getSupportVisitorIdentity();
  const contentUrl = new URL(
    `${connection.clientApiUrl.replace(/\\/$/u, '')}/media/${encodeURIComponent(item.id)}/content`,
  );
  contentUrl.searchParams.set('visitorId', identity.visitorId);
  return {
    messageId: item.messageId,
    attachment: {
      id: item.id,
      kind: 'image',
      mimeType: item.mimeType,
      byteSize: item.byteSize,
      width: item.width as number | null,
      height: item.height as number | null,
      originalName: item.originalName,
      url: contentUrl.toString(),
    },
  };
}

function parseMessage(
  connection: PublicSupportConnection,
  value: unknown,
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
  const media = parseMedia(connection, mediaValue);
  return {
    id: item.id,
    direction: item.direction,
    body: item.body,
    sentAt: item.sentAt,
    delivery: item.delivery,
    attachments:
      media && media.messageId === item.id ? [media.attachment] : [],
  };
}

function emptyEvent(
  state: SocketState,
  type: string,
): SupportRealtimeEvent {
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

function parseEvent(
  state: SocketState,
  raw: unknown,
): SupportRealtimeEvent | null {
  if (!isRecord(raw) || typeof raw.type !== 'string' || !raw.type.trim()) return null;
  if (raw.type === 'ready' || raw.type === 'pong') return null;
  const remoteConversationId =
    typeof raw.conversationId === 'string' ? raw.conversationId.trim() : '';
  const conversation = parseConversation(state.connection.id, raw.conversation);
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
    message: parseMessage(state.connection, raw.message, raw.media),
    reader: raw.reader === 'agent' || raw.reader === 'visitor' ? raw.reader : null,
    lastMessageId:
      typeof raw.lastMessageId === 'string' ? raw.lastMessageId : null,
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
""",
)

write(
    'apps/storefront/src/support-realtime-cache.ts',
    """import type {
  SupportConversationDetail,
  SupportConversationSummary,
  SupportMessage,
} from './support-contract';
import type { SupportRealtimeEvent } from './support-realtime';

export type SupportConversationQueryCache = {
  pages: Array<SupportConversationDetail | null>;
  pageParams: Array<string | null>;
};

function timestamp(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function applyRealtimeToConversationList(
  current: SupportConversationSummary[] | undefined,
  event: SupportRealtimeEvent,
): SupportConversationSummary[] | undefined {
  if (!current || !event.conversation) return current;
  const next = event.conversation;
  const withoutCurrent = current.filter((item) => item.id !== next.id);
  return [next, ...withoutCurrent].sort(
    (left, right) => timestamp(right.lastMessageAt) - timestamp(left.lastMessageAt),
  );
}

function mergeMessage(
  messages: SupportMessage[],
  incoming: SupportMessage,
): SupportMessage[] {
  const existing = messages.find((message) => message.id === incoming.id);
  if (!existing) return [...messages, incoming];
  return messages.map((message) =>
    message.id === incoming.id
      ? {
          ...message,
          ...incoming,
          attachments:
            incoming.attachments.length > 0
              ? incoming.attachments
              : message.attachments,
        }
      : message,
  );
}

function applyReadState(
  messages: SupportMessage[],
  reader: SupportRealtimeEvent['reader'],
): SupportMessage[] {
  if (!reader) return messages;
  const direction = reader === 'agent' ? 'customer' : 'agent';
  return messages.map((message) =>
    message.direction === direction && message.delivery === 'sent'
      ? { ...message, delivery: 'read' as const }
      : message,
  );
}

export function applyRealtimeToConversationCache(
  current: SupportConversationQueryCache | undefined,
  event: SupportRealtimeEvent,
): SupportConversationQueryCache | undefined {
  if (!current || !event.conversationRef) return current;
  const first = current.pages[0];
  if (!first || first.id !== event.conversationRef) return current;

  let messages = first.messages;
  if (event.message) messages = mergeMessage(messages, event.message);
  if (event.type === 'message.read') messages = applyReadState(messages, event.reader);

  const summary = event.conversation;
  const updated: SupportConversationDetail = {
    ...first,
    ...(summary
      ? {
          agentName: summary.agentName,
          agentAvatarUrl: summary.agentAvatarUrl,
          productTitle: summary.productTitle,
          productCoverUrl: summary.productCoverUrl,
          lastMessage: summary.lastMessage,
          lastMessageAt: summary.lastMessageAt,
          unreadCount: summary.unreadCount,
          status: summary.status,
        }
      : {}),
    ...(event.type === 'message.read' && event.reader === 'visitor'
      ? { unreadCount: 0 }
      : {}),
    messages,
  };
  return { ...current, pages: [updated, ...current.pages.slice(1)] };
}
""",
)

# ---------------------------------------------------------------------------
# Media completion returns the exact newly created message so callers can apply
# it locally instead of issuing GET conversation + GET media after every image.
# ---------------------------------------------------------------------------
replace_once(
    'apps/storefront/src/support-contract.ts',
    """  sendImage(
    conversationRef: string,
    input: SendSupportImageInput,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal,
  ): Promise<void>;""",
    """  sendImage(
    conversationRef: string,
    input: SendSupportImageInput,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal,
  ): Promise<SupportMessage>;""",
)

replace_once(
    'apps/storefront/src/support-media-gateway.ts',
    """import type { SendSupportImageInput, SupportImageAttachment } from './support-contract';""",
    """import type {
  SendSupportImageInput,
  SupportImageAttachment,
  SupportMessage,
} from './support-contract';""",
)
replace_once(
    'apps/storefront/src/support-media-gateway.ts',
    """type InitResponse = {
  media: { id: string };
  upload: SupportUploadTarget;
};""",
    """type InitResponse = {
  media: { id: string };
  upload: SupportUploadTarget;
};

type CompleteResponse = {
  messageId: string;
  createdAt?: string;
  media: Omit<RemoteMediaItem, 'messageId'>;
};""",
)
replace_once(
    'apps/storefront/src/support-media-gateway.ts',
    """  signal?: AbortSignal,
): Promise<void> {""",
    """  signal?: AbortSignal,
): Promise<SupportMessage> {""",
)
replace_once(
    'apps/storefront/src/support-media-gateway.ts',
    """  await requestJson(
    remoteUrl(
      connection,
      `/media/${encodeURIComponent(init.media.id)}/complete`,
    ).toString(),
    {
      method: 'POST',
      body: JSON.stringify({ visitorId: identity.visitorId }),
    },
    signal,
  );
}""",
    """  const complete = await requestJson<CompleteResponse>(
    remoteUrl(
      connection,
      `/media/${encodeURIComponent(init.media.id)}/complete`,
    ).toString(),
    {
      method: 'POST',
      body: JSON.stringify({ visitorId: identity.visitorId }),
    },
    signal,
  );
  if (!complete?.messageId || !complete.media || !validCompletedMedia(complete.media)) {
    throw new Error('Invalid media completion response.');
  }
  const contentUrl = remoteUrl(
    connection,
    `/media/${encodeURIComponent(complete.media.id)}/content`,
  );
  contentUrl.searchParams.set('visitorId', identity.visitorId);
  return {
    id: complete.messageId,
    direction: 'customer',
    body: '',
    sentAt: complete.createdAt ?? new Date().toISOString(),
    delivery: 'sent',
    attachments: [
      {
        id: complete.media.id,
        kind: 'image',
        mimeType: complete.media.mimeType,
        byteSize: complete.media.byteSize,
        width: complete.media.width,
        height: complete.media.height,
        originalName: complete.media.originalName,
        url: contentUrl.toString(),
      },
    ],
  };
}""",
)
replace_once(
    'apps/storefront/src/support-media-gateway.ts',
    """function validMedia(value: RemoteMediaItem): boolean {
  return (
    typeof value?.messageId === 'string' &&
    typeof value?.id === 'string' &&
    value.kind === 'image' &&
    typeof value.mimeType === 'string' &&
    Number.isFinite(value.byteSize) &&
    value.status === 'ready'
  );
}""",
    """function validMedia(value: RemoteMediaItem): boolean {
  return typeof value?.messageId === 'string' && validCompletedMedia(value);
}

function validCompletedMedia(
  value: Omit<RemoteMediaItem, 'messageId'>,
): boolean {
  return (
    typeof value?.id === 'string' &&
    value.kind === 'image' &&
    typeof value.mimeType === 'string' &&
    Number.isFinite(value.byteSize) &&
    value.status === 'ready'
  );
}""",
)

replace_once(
    'apps/storefront/src/support-gateway.ts',
    """    await sendConversationImage(
      connection,
      remoteConversationId,
      input,
      onProgress,
      signal,
    );""",
    """    return sendConversationImage(
      connection,
      remoteConversationId,
      input,
      onProgress,
      signal,
    );""",
)

# ---------------------------------------------------------------------------
# Storefront root: remove periodic polling. Cache deltas arrive over WS; only a
# reconnect triggers a REST reconciliation.
# ---------------------------------------------------------------------------
replace_once(
    'apps/storefront/src/StorefrontRoot.tsx',
    """import { subscribeSupportRealtime } from './support-realtime';""",
    """import { subscribeSupportRealtime } from './support-realtime';
import {
  applyRealtimeToConversationCache,
  applyRealtimeToConversationList,
  type SupportConversationQueryCache,
} from './support-realtime-cache';""",
)
replace_once(
    'apps/storefront/src/StorefrontRoot.tsx',
    """  const supportConversationsQuery = useQuery({
    queryKey: ['support-conversations'],
    queryFn: ({ signal }) => siteSupportGateway.listConversations(signal),
    staleTime: 5_000,
    retry: 1,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });""",
    """  const supportConversationsQuery = useQuery({
    queryKey: ['support-conversations'],
    queryFn: ({ signal }) => siteSupportGateway.listConversations(signal),
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
    refetchOnWindowFocus: false,
  });""",
)
replace_once(
    'apps/storefront/src/StorefrontRoot.tsx',
    """  useEffect(
    () =>
      subscribeSupportRealtime((event) => {
        void queryClient.invalidateQueries({ queryKey: ['support-conversations'] });
        if (event.conversationRef) {
          void queryClient.invalidateQueries({
            queryKey: ['support-conversation', event.conversationRef],
          });
        }
      }),
    [queryClient],
  );""",
    """  useEffect(
    () =>
      subscribeSupportRealtime((event) => {
        if (event.type === 'realtime.recovered') {
          void queryClient.invalidateQueries({ queryKey: ['support-conversations'] });
          void queryClient.invalidateQueries({ queryKey: ['support-conversation'] });
          return;
        }
        if (event.type === 'realtime.connected') return;
        queryClient.setQueryData(['support-conversations'], (current) =>
          applyRealtimeToConversationList(current, event),
        );
        if (event.conversationRef) {
          queryClient.setQueryData<SupportConversationQueryCache>(
            ['support-conversation', event.conversationRef],
            (current) => applyRealtimeToConversationCache(current, event),
          );
        }
      }),
    [queryClient],
  );""",
)

# ---------------------------------------------------------------------------
# Messages page: use mutation responses + realtime cache updates, not
# invalidate/refetch after each send/read/image.
# ---------------------------------------------------------------------------
replace_once(
    'apps/storefront/src/MessagesPage.tsx',
    """  const conversationsQuery = useQuery({
    queryKey: ['support-conversations'],
    queryFn: ({ signal }) => siteSupportGateway.listConversations(signal),
    enabled: supportAvailable === true,
    staleTime: 5_000,
    retry: 1,
  });""",
    """  const conversationsQuery = useQuery({
    queryKey: ['support-conversations'],
    queryFn: ({ signal }) => siteSupportGateway.listConversations(signal),
    enabled: supportAvailable === true,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
    refetchOnWindowFocus: false,
  });""",
)
replace_once(
    'apps/storefront/src/MessagesPage.tsx',
    """    getNextPageParam: (page) => page?.nextMessageCursor ?? undefined,
    retry: 1,
  });""",
    """    getNextPageParam: (page) => page?.nextMessageCursor ?? undefined,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
    refetchOnWindowFocus: false,
  });""",
)

replace_once(
    'apps/storefront/src/MessagesPage.tsx',
    """      if (result.kind === 'conversation') {
        setComposeOptimisticMessage(null);
        void queryClient.invalidateQueries({ queryKey: ['support-conversations'] });
        window.history.pushState(
          null,
          '',
          `/messages/${encodeURIComponent(result.conversation.id)}/`,
        );
        window.dispatchEvent(new Event(NAVIGATION_EVENT));
        return;
      }""",
    """      if (result.kind === 'conversation') {
        setComposeOptimisticMessage(null);
        queryClient.setQueryData<SupportConversationSummary[]>(
          ['support-conversations'],
          (current) => {
            const summary = conversationSummary(result.conversation);
            const withoutCurrent = (current ?? []).filter(
              (item) => item.id !== summary.id,
            );
            return [summary, ...withoutCurrent];
          },
        );
        queryClient.setQueryData<ConversationQueryCache>(
          ['support-conversation', result.conversation.id],
          { pages: [result.conversation], pageParams: [null] },
        );
        window.history.pushState(
          null,
          '',
          `/messages/${encodeURIComponent(result.conversation.id)}/`,
        );
        window.dispatchEvent(new Event(NAVIGATION_EVENT));
        return;
      }""",
)
replace_once(
    'apps/storefront/src/MessagesPage.tsx',
    """        void queryClient.invalidateQueries({ queryKey: ['support-conversations'] });""",
    """        updateConversationPreview(
          queryClient,
          variables.conversationRef,
          result.message.body,
          result.message.sentAt,
        );""",
)

replace_once(
    'apps/storefront/src/MessagesPage.tsx',
    """        await siteSupportGateway.sendImage(
          conversationRef,
          {
            blob: image.blob,
            mimeType: image.mimeType,
            byteSize: image.byteSize,
            width: image.width,
            height: image.height,
            originalName: image.originalName,
          },
          setImageProgress,
        );""",
    """        return await siteSupportGateway.sendImage(
          conversationRef,
          {
            blob: image.blob,
            mimeType: image.mimeType,
            byteSize: image.byteSize,
            width: image.width,
            height: image.height,
            originalName: image.originalName,
          },
          setImageProgress,
        );""",
)
replace_once(
    'apps/storefront/src/MessagesPage.tsx',
    """    onSuccess: (_result, variables) => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['support-conversations'] }),
        queryClient.invalidateQueries({
          queryKey: ['support-conversation', variables.conversationRef],
        }),
      ]).finally(() => {
        setImagePreviewUrl((current) =>
          current === variables.previewUrl ? null : current,
        );
        setImageProgress(null);
        URL.revokeObjectURL(variables.previewUrl);
      });
    },""",
    """    onSuccess: (message, variables) => {
      upsertOptimisticMessage(queryClient, variables.conversationRef, message);
      updateConversationPreview(
        queryClient,
        variables.conversationRef,
        message.body,
        message.sentAt,
      );
      setImagePreviewUrl((current) =>
        current === variables.previewUrl ? null : current,
      );
      setImageProgress(null);
      URL.revokeObjectURL(variables.previewUrl);
    },""",
)

replace_once(
    'apps/storefront/src/MessagesPage.tsx',
    """      .then(async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['support-conversations'] }),
          queryClient.invalidateQueries({
            queryKey: ['support-conversation', activeConversationRef],
          }),
        ]);
      })
      .catch(() => undefined);""",
    """      .then(() => {
        queryClient.setQueryData<SupportConversationSummary[]>(
          ['support-conversations'],
          (current) =>
            current?.map((conversation) =>
              conversation.id === activeConversationRef
                ? { ...conversation, unreadCount: 0 }
                : conversation,
            ) ?? current,
        );
        updateConversationCache(
          queryClient,
          activeConversationRef,
          (conversation) => ({
            ...conversation,
            unreadCount: 0,
            messages: conversation.messages.map((message) =>
              message.direction === 'agent' && message.delivery === 'sent'
                ? { ...message, delivery: 'read' }
                : message,
            ),
          }),
        );
      })
      .catch(() => undefined);""",
)

# Add helper used by start-conversation local cache priming.
replace_once(
    'apps/storefront/src/MessagesPage.tsx',
    """function updateConversationCache(
  queryClient: QueryClient,""",
    """function conversationSummary(
  conversation: SupportConversationDetail,
): SupportConversationSummary {
  return {
    id: conversation.id,
    agentName: conversation.agentName,
    agentAvatarUrl: conversation.agentAvatarUrl,
    productTitle: conversation.productTitle,
    productCoverUrl: conversation.productCoverUrl,
    lastMessage: conversation.lastMessage,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount: conversation.unreadCount,
    status: conversation.status,
  };
}

function updateConversationCache(
  queryClient: QueryClient,""",
)

# Ensure summary type is imported (it already is in the import block in current file,
# but keep this assertion explicit to fail loudly if upstream changed).
if 'SupportConversationSummary,' not in read('apps/storefront/src/MessagesPage.tsx'):
    raise RuntimeError('MessagesPage is expected to import SupportConversationSummary')

# ---------------------------------------------------------------------------
# Contract-level tests guard the request-count invariant without making CI sleep
# through the old 30-second polling interval.
# ---------------------------------------------------------------------------
write(
    'apps/storefront/test/support-realtime-transport.test.mjs',
    """import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('support realtime is websocket-first with REST reserved for recovery', () => {
  const root = source('../src/StorefrontRoot.tsx');
  const realtime = source('../src/support-realtime.ts');
  const messages = source('../src/MessagesPage.tsx');
  const media = source('../src/support-media-gateway.ts');

  assert.ok(!root.includes('refetchInterval: 30_000'));
  assert.ok(root.includes("event.type === 'realtime.recovered'"));
  assert.ok(root.includes('setQueryData'));
  assert.ok(realtime.includes("recovered ? 'realtime.recovered' : 'realtime.connected'"));
  assert.ok(realtime.includes('parseMessage(state.connection, raw.message, raw.media)'));
  assert.ok(messages.includes('staleTime: Number.POSITIVE_INFINITY'));
  assert.ok(!messages.includes("invalidateQueries({ queryKey: ['support-conversations'] })"));
  assert.ok(media.includes('Promise<SupportMessage>'));
});
""",
)

print('Storefront realtime optimization patch applied.')
