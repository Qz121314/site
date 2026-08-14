import type {
  SendSupportImageInput,
  SendSupportMessageInput,
  StartSupportConversationInput,
  SupportConversationDetail,
  SupportConversationSummary,
  SupportGateway,
  SupportMessage,
} from './support-contract';
import { getSupportVisitorIdentity } from './support-identity';
import { loadConversationMedia, sendConversationImage } from './support-media-gateway';

export class SupportApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'SupportApiError';
    this.status = status;
    this.code = code;
  }
}

export type PublicSupportConnection = {
  id: string;
  clientApiUrl: string;
  realtimeUrl: string;
  protocolVersion: 'v1';
};

type ResolvedSupportRoute = {
  available: true;
  connection: PublicSupportConnection;
  groupId: string;
};

type RemoteConversationSummary = SupportConversationSummary & {
  productId: string;
  sectionId: string;
};

type RemoteConversationDetail = RemoteConversationSummary & {
  productHref?: string | null;
  createdAt: string;
  expiresAt: string;
  messages: SupportMessage[];
  nextMessageCursor: string | null;
};

type ErrorEnvelope = { error?: { code?: string; message?: string } };

const CONNECTION_CACHE_MS = 30_000;
let connectionCache: {
  expiresAt: number;
  connections: PublicSupportConnection[];
} | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('application/json') ? response.json() : null;
}

async function siteRequestJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(path, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    ...(signal ? { signal } : {}),
  });
  const body = await readJson(response);
  if (!response.ok) {
    const envelope = isRecord(body) ? (body as ErrorEnvelope) : null;
    throw new SupportApiError(
      response.status,
      envelope?.error?.code ?? 'SUPPORT_CONFIG_FAILED',
      envelope?.error?.message ?? 'Messages is temporarily unavailable.',
    );
  }
  return body;
}

function parseConnection(value: unknown): PublicSupportConnection {
  const item = isRecord(value) ? value : null;
  if (
    !item ||
    typeof item.id !== 'string' ||
    typeof item.clientApiUrl !== 'string' ||
    typeof item.realtimeUrl !== 'string' ||
    item.protocolVersion !== 'v1'
  ) {
    throw new SupportApiError(
      500,
      'INVALID_SUPPORT_CONFIG',
      'Messages returned invalid configuration.',
    );
  }
  return {
    id: item.id,
    clientApiUrl: item.clientApiUrl.replace(/\/$/u, ''),
    realtimeUrl: item.realtimeUrl,
    protocolVersion: 'v1',
  };
}

export async function loadPublicSupportConnections(
  signal?: AbortSignal,
): Promise<PublicSupportConnection[]> {
  const now = Date.now();
  if (connectionCache && connectionCache.expiresAt > now)
    return connectionCache.connections;
  const value = await siteRequestJson(
    '/api/public/storefront/support/connections',
    signal,
  );
  const envelope = isRecord(value) ? value : null;
  if (!envelope || !Array.isArray(envelope.connections)) {
    throw new SupportApiError(
      500,
      'INVALID_SUPPORT_CONFIG',
      'Messages returned invalid configuration.',
    );
  }
  const connections = envelope.connections.map(parseConnection);
  connectionCache = { expiresAt: now + CONNECTION_CACHE_MS, connections };
  return connections;
}

async function resolveSupportRoute(
  productId: string,
  sectionId: string,
  signal?: AbortSignal,
): Promise<ResolvedSupportRoute> {
  const query = new URLSearchParams({ sectionId });
  const value = await siteRequestJson(
    `/api/public/storefront/support/route/${encodeURIComponent(productId)}?${query.toString()}`,
    signal,
  );
  const envelope = isRecord(value) ? value : null;
  if (!envelope || envelope.available !== true || typeof envelope.groupId !== 'string') {
    throw new SupportApiError(
      409,
      'SUPPORT_UNAVAILABLE',
      'Customer service is unavailable.',
    );
  }
  return {
    available: true,
    connection: parseConnection(envelope.connection),
    groupId: envelope.groupId,
  };
}

function remoteUrl(connection: PublicSupportConnection, path: string): string {
  return `${connection.clientApiUrl}${path}`;
}

function clientQueryUrl(
  connection: PublicSupportConnection,
  path: string,
  values?: Record<string, string | null | undefined>,
): string {
  const identity = getSupportVisitorIdentity();
  const url = new URL(remoteUrl(connection, path));
  url.searchParams.set('visitorId', identity.visitorId);
  for (const [key, value] of Object.entries(values ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

function clientBody(body: Record<string, unknown>): Record<string, unknown> {
  const identity = getSupportVisitorIdentity();
  return {
    visitorId: identity.visitorId,
    ...body,
  };
}

async function remoteRequestJson(
  url: string,
  init?: RequestInit,
  signal?: AbortSignal,
): Promise<unknown> {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body !== undefined) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: 'no-store',
      credentials: 'omit',
      mode: 'cors',
      redirect: 'error',
      headers,
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new SupportApiError(
      503,
      'SUPPORT_UNREACHABLE',
      'Messages is temporarily unavailable.',
    );
  }
  const body = await readJson(response);
  if (!response.ok) {
    const envelope = isRecord(body) ? (body as ErrorEnvelope) : null;
    throw new SupportApiError(
      response.status,
      envelope?.error?.code ?? 'SUPPORT_REQUEST_FAILED',
      envelope?.error?.message ?? 'Messages is temporarily unavailable.',
    );
  }
  return body;
}

export function wrapSupportConversationRef(
  connectionId: string,
  remoteConversationId: string,
): string {
  return `${connectionId}:${encodeURIComponent(remoteConversationId)}`;
}

function parseSupportConversationRef(
  value: string,
): { connectionId: string; remoteConversationId: string } | null {
  const separator = value.indexOf(':');
  if (separator < 1 || separator === value.length - 1) return null;
  const connectionId = value.slice(0, separator);
  try {
    const remoteConversationId = decodeURIComponent(value.slice(separator + 1));
    if (!remoteConversationId) return null;
    return { connectionId, remoteConversationId };
  } catch {
    return null;
  }
}

function parseMessage(value: unknown): SupportMessage {
  const item = isRecord(value) ? value : null;
  if (
    !item ||
    typeof item.id !== 'string' ||
    (item.direction !== 'customer' && item.direction !== 'agent') ||
    typeof item.body !== 'string' ||
    typeof item.sentAt !== 'string' ||
    (item.delivery !== 'sending' && item.delivery !== 'sent' && item.delivery !== 'read')
  ) {
    throw new SupportApiError(
      500,
      'INVALID_SUPPORT_RESPONSE',
      'Messages returned invalid message data.',
    );
  }
  return { ...(item as Omit<SupportMessage, 'attachments'>), attachments: [] };
}

function parseRemoteSummary(value: unknown): RemoteConversationSummary {
  const item = isRecord(value) ? value : null;
  if (
    !item ||
    typeof item.id !== 'string' ||
    !nullableString(item.agentName) ||
    !nullableString(item.agentAvatarUrl) ||
    typeof item.productId !== 'string' ||
    typeof item.sectionId !== 'string' ||
    typeof item.productTitle !== 'string' ||
    !nullableString(item.productCoverUrl) ||
    !nullableString(item.lastMessage) ||
    !nullableString(item.lastMessageAt) ||
    typeof item.unreadCount !== 'number' ||
    !Number.isInteger(item.unreadCount) ||
    (item.status !== 'waiting' && item.status !== 'active' && item.status !== 'closed')
  ) {
    throw new SupportApiError(
      500,
      'INVALID_SUPPORT_RESPONSE',
      'Messages returned invalid conversation data.',
    );
  }
  return item as RemoteConversationSummary;
}

function normalizeSummary(
  connection: PublicSupportConnection,
  remote: RemoteConversationSummary,
): SupportConversationSummary {
  return {
    id: wrapSupportConversationRef(connection.id, remote.id),
    agentName: remote.agentName,
    agentAvatarUrl: remote.agentAvatarUrl,
    productTitle: remote.productTitle,
    productCoverUrl: remote.productCoverUrl,
    lastMessage: remote.lastMessage,
    lastMessageAt: remote.lastMessageAt,
    unreadCount: remote.unreadCount,
    status: remote.status,
  };
}

function parseRemoteDetail(value: unknown): RemoteConversationDetail {
  const item = isRecord(value) ? value : null;
  if (
    !item ||
    typeof item.createdAt !== 'string' ||
    typeof item.expiresAt !== 'string' ||
    !Array.isArray(item.messages) ||
    !nullableString(item.nextMessageCursor)
  ) {
    throw new SupportApiError(
      500,
      'INVALID_SUPPORT_RESPONSE',
      'Messages returned invalid conversation data.',
    );
  }
  let productHref: string | null | undefined;
  if (item.productHref !== undefined) {
    if (!nullableString(item.productHref)) {
      throw new SupportApiError(
        500,
        'INVALID_SUPPORT_RESPONSE',
        'Messages returned invalid conversation data.',
      );
    }
    productHref = item.productHref;
  }
  return {
    ...parseRemoteSummary(item),
    ...(productHref !== undefined ? { productHref } : {}),
    createdAt: item.createdAt,
    expiresAt: item.expiresAt,
    messages: item.messages.map(parseMessage),
    nextMessageCursor: item.nextMessageCursor,
  };
}

function normalizeDetail(
  connection: PublicSupportConnection,
  remote: RemoteConversationDetail,
): SupportConversationDetail {
  return {
    ...normalizeSummary(connection, remote),
    productHref:
      remote.productHref ??
      `/sections/${encodeURIComponent(remote.sectionId)}/products/${encodeURIComponent(remote.productId)}/`,
    createdAt: remote.createdAt,
    expiresAt: remote.expiresAt,
    messages: remote.messages,
    nextMessageCursor: remote.nextMessageCursor,
  };
}

function conversationEnvelope(
  connection: PublicSupportConnection,
  value: unknown,
): SupportConversationDetail {
  const envelope = isRecord(value) ? value : null;
  if (!envelope) {
    throw new SupportApiError(
      500,
      'INVALID_SUPPORT_RESPONSE',
      'Messages returned invalid data.',
    );
  }
  return normalizeDetail(connection, parseRemoteDetail(envelope.conversation));
}

function attachConversationMedia(
  conversation: SupportConversationDetail,
  media: Map<string, SupportMessage['attachments']>,
): SupportConversationDetail {
  return {
    ...conversation,
    messages: conversation.messages.map((message) => ({
      ...message,
      attachments: media.get(message.id) ?? [],
    })),
  };
}

async function connectionForConversationRef(
  conversationRef: string,
  signal?: AbortSignal,
): Promise<{ connection: PublicSupportConnection; remoteConversationId: string }> {
  const parsed = parseSupportConversationRef(conversationRef);
  if (!parsed)
    throw new SupportApiError(
      404,
      'SUPPORT_CONVERSATION_NOT_FOUND',
      'Conversation not found.',
    );
  const connections = await loadPublicSupportConnections(signal);
  const connection = connections.find((item) => item.id === parsed.connectionId);
  if (!connection)
    throw new SupportApiError(
      404,
      'SUPPORT_CONVERSATION_NOT_FOUND',
      'Conversation not found.',
    );
  return { connection, remoteConversationId: parsed.remoteConversationId };
}

function conversationTimestamp(value: string | null): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function buildSupportWebSocketUrl(connection: PublicSupportConnection): string {
  const identity = getSupportVisitorIdentity();
  const url = new URL(connection.realtimeUrl);
  url.searchParams.set('visitorId', identity.visitorId);
  return url.toString();
}

export const siteSupportGateway: SupportGateway = {
  async listConversations(signal) {
    const connections = await loadPublicSupportConnections(signal);
    if (connections.length === 0) return [];
    const settled = await Promise.allSettled(
      connections.map(async (connection) => {
        const value = await remoteRequestJson(
          clientQueryUrl(connection, '/conversations'),
          undefined,
          signal,
        );
        const envelope = isRecord(value) ? value : null;
        if (!envelope || !Array.isArray(envelope.conversations)) {
          throw new SupportApiError(
            500,
            'INVALID_SUPPORT_RESPONSE',
            'Messages returned invalid data.',
          );
        }
        return envelope.conversations.map((item) =>
          normalizeSummary(connection, parseRemoteSummary(item)),
        );
      }),
    );
    const successful = settled.filter(
      (result): result is PromiseFulfilledResult<SupportConversationSummary[]> =>
        result.status === 'fulfilled',
    );
    if (
      successful.length === 0 &&
      settled.some((result) => result.status === 'rejected')
    ) {
      throw new SupportApiError(
        503,
        'SUPPORT_UNREACHABLE',
        'Messages is temporarily unavailable.',
      );
    }
    return successful
      .flatMap((result) => result.value)
      .sort(
        (left, right) =>
          conversationTimestamp(right.lastMessageAt) -
          conversationTimestamp(left.lastMessageAt),
      );
  },

  async getConversation(conversationRef, before = null, signal) {
    const { connection, remoteConversationId } = await connectionForConversationRef(
      conversationRef,
      signal,
    );
    try {
      const [value, media] = await Promise.all([
        remoteRequestJson(
          clientQueryUrl(
            connection,
            `/conversations/${encodeURIComponent(remoteConversationId)}`,
            { before, limit: '30' },
          ),
          undefined,
          signal,
        ),
        loadConversationMedia(connection, remoteConversationId, signal),
      ]);
      return attachConversationMedia(conversationEnvelope(connection, value), media);
    } catch (error) {
      if (error instanceof SupportApiError && error.status === 404) return null;
      throw error;
    }
  },

  async startConversation(input: StartSupportConversationInput, signal) {
    const route = await resolveSupportRoute(input.productId, input.sectionId, signal);
    const value = await remoteRequestJson(
      remoteUrl(route.connection, '/conversations'),
      {
        method: 'POST',
        body: JSON.stringify(
          clientBody({
            groupId: route.groupId,
            clientMessageId: input.clientMessageId,
            message: input.message,
            product: {
              id: input.productId,
              sectionId: input.sectionId,
              title: input.productTitle,
              href: input.productHref,
              coverUrl: input.productCoverUrl,
            },
          }),
        ),
      },
      signal,
    );
    return conversationEnvelope(route.connection, value);
  },

  async sendMessage(conversationRef: string, input: SendSupportMessageInput, signal) {
    const { connection, remoteConversationId } = await connectionForConversationRef(
      conversationRef,
      signal,
    );
    const value = await remoteRequestJson(
      remoteUrl(
        connection,
        `/conversations/${encodeURIComponent(remoteConversationId)}/messages`,
      ),
      {
        method: 'POST',
        body: JSON.stringify(
          clientBody({
            clientMessageId: input.clientMessageId,
            body: input.body,
          }),
        ),
      },
      signal,
    );
    const envelope = isRecord(value) ? value : null;
    return parseMessage(envelope?.message);
  },

  async sendImage(
    conversationRef: string,
    input: SendSupportImageInput,
    onProgress,
    signal,
  ) {
    const { connection, remoteConversationId } = await connectionForConversationRef(
      conversationRef,
      signal,
    );
    await sendConversationImage(
      connection,
      remoteConversationId,
      input,
      onProgress,
      signal,
    );
  },

  async markConversationRead(conversationRef, lastMessageId = null, signal) {
    const { connection, remoteConversationId } = await connectionForConversationRef(
      conversationRef,
      signal,
    );
    const value = await remoteRequestJson(
      remoteUrl(
        connection,
        `/conversations/${encodeURIComponent(remoteConversationId)}/read`,
      ),
      {
        method: 'POST',
        body: JSON.stringify(clientBody({ lastMessageId })),
      },
      signal,
    );
    const envelope = isRecord(value) ? value : null;
    if (!envelope || envelope.ok !== true) {
      throw new SupportApiError(
        500,
        'INVALID_SUPPORT_RESPONSE',
        'Messages returned invalid data.',
      );
    }
  },
};
