import type {
  SendSupportMessageInput,
  StartSupportConversationInput,
  SupportConversationDetail,
  SupportConversationSummary,
  SupportGateway,
  SupportMessage,
} from './support-contract';

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

type ErrorEnvelope = { error?: { code?: string; message?: string } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
    headers,
  });
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() as unknown : null;
  if (!response.ok) {
    const envelope = isRecord(body) ? body as ErrorEnvelope : null;
    throw new SupportApiError(
      response.status,
      envelope?.error?.code ?? 'MESSAGES_REQUEST_FAILED',
      envelope?.error?.message ?? 'Messages is temporarily unavailable.',
    );
  }
  return body;
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function parseSummary(value: unknown): SupportConversationSummary {
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
    throw new SupportApiError(500, 'INVALID_MESSAGES_RESPONSE', 'Messages returned invalid data.');
  }
  return item as SupportConversationSummary;
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
    throw new SupportApiError(500, 'INVALID_MESSAGES_RESPONSE', 'Messages returned invalid message data.');
  }
  return item as SupportMessage;
}

function parseDetail(value: unknown): SupportConversationDetail {
  const item = isRecord(value) ? value : null;
  if (
    !item ||
    !nullableString(item.productHref) ||
    typeof item.createdAt !== 'string' ||
    typeof item.expiresAt !== 'string' ||
    !Array.isArray(item.messages) ||
    !nullableString(item.nextMessageCursor)
  ) {
    throw new SupportApiError(500, 'INVALID_MESSAGES_RESPONSE', 'Messages returned invalid conversation data.');
  }
  return {
    ...parseSummary(item),
    productHref: item.productHref,
    createdAt: item.createdAt,
    expiresAt: item.expiresAt,
    messages: item.messages.map(parseMessage),
    nextMessageCursor: item.nextMessageCursor,
  };
}

function conversationEnvelope(value: unknown): SupportConversationDetail {
  const envelope = isRecord(value) ? value : null;
  if (!envelope) {
    throw new SupportApiError(500, 'INVALID_MESSAGES_RESPONSE', 'Messages returned invalid data.');
  }
  return parseDetail(envelope.conversation);
}

function jsonRequest(method: 'POST', body: unknown, signal?: AbortSignal): RequestInit {
  return {
    method,
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  };
}

const basePath = '/api/messages/v1/conversations';

export const siteSupportGateway: SupportGateway = {
  async listConversations(signal) {
    const value = await requestJson(basePath, signal ? { signal } : undefined);
    const envelope = isRecord(value) ? value : null;
    if (!envelope || !Array.isArray(envelope.conversations)) {
      throw new SupportApiError(500, 'INVALID_MESSAGES_RESPONSE', 'Messages returned invalid data.');
    }
    return envelope.conversations.map(parseSummary);
  },

  async getConversation(conversationRef, before = null, signal) {
    const query = new URLSearchParams({ limit: '30' });
    if (before) query.set('before', before);
    try {
      return conversationEnvelope(
        await requestJson(
          `${basePath}/${encodeURIComponent(conversationRef)}?${query.toString()}`,
          signal ? { signal } : undefined,
        ),
      );
    } catch (error) {
      if (error instanceof SupportApiError && error.status === 404) return null;
      throw error;
    }
  },

  async startConversation(input: StartSupportConversationInput, signal) {
    return conversationEnvelope(await requestJson(basePath, jsonRequest('POST', input, signal)));
  },

  async sendMessage(conversationRef: string, input: SendSupportMessageInput, signal) {
    const value = await requestJson(
      `${basePath}/${encodeURIComponent(conversationRef)}/messages`,
      jsonRequest('POST', input, signal),
    );
    const envelope = isRecord(value) ? value : null;
    return parseMessage(envelope?.message);
  },

  async markConversationRead(conversationRef, lastMessageId = null, signal) {
    const value = await requestJson(
      `${basePath}/${encodeURIComponent(conversationRef)}/read`,
      jsonRequest('POST', { lastMessageId }, signal),
    );
    const envelope = isRecord(value) ? value : null;
    if (!envelope || envelope.ok !== true) {
      throw new SupportApiError(500, 'INVALID_MESSAGES_RESPONSE', 'Messages returned invalid data.');
    }
  },
};
