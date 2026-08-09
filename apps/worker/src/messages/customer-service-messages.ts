import type { CustomerServiceConnectionInternal } from '../customer-service/customer-service-connections';
import {
  CustomerServiceProviderError,
  customerServiceProviderFetchJson,
} from '../customer-service/customer-service-provider';

export type RemoteConversationStatus = 'waiting' | 'active' | 'closed';

export type RemoteConversationSummary = {
  id: string;
  agentName: string | null;
  agentAvatarUrl: string | null;
  productId: string;
  sectionId: string;
  productTitle: string;
  productCoverUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  status: RemoteConversationStatus;
};

export type RemoteSupportMessage = {
  id: string;
  direction: 'customer' | 'agent';
  body: string;
  sentAt: string;
  delivery: 'sent' | 'read';
};

export type RemoteConversationDetail = RemoteConversationSummary & {
  createdAt: string;
  expiresAt: string;
  messages: RemoteSupportMessage[];
  nextMessageCursor: string | null;
};

export type StartRemoteConversationInput = {
  remoteGroupId: string;
  clientMessageId: string;
  message: string;
  product: {
    id: string;
    sectionId: string;
    title: string;
    href: string;
    coverUrl: string | null;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nullableText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function requiredText(value: unknown, maxLength: number): string | null {
  const normalized = nullableText(value, maxLength);
  return normalized || null;
}

function safeHttpsUrl(value: unknown): string | null {
  const text = nullableText(value, 2000);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseSummary(value: unknown): RemoteConversationSummary {
  const item = isRecord(value) ? value : null;
  const id = requiredText(item?.id, 400);
  const productId = requiredText(item?.productId, 120);
  const sectionId = requiredText(item?.sectionId, 120);
  const productTitle = requiredText(item?.productTitle, 240);
  if (!item || !id || !productId || !sectionId || !productTitle) {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_MESSAGES_RESPONSE',
      '客服系统会话接口返回格式无效。',
    );
  }
  if (item.status !== 'waiting' && item.status !== 'active' && item.status !== 'closed') {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_MESSAGES_RESPONSE',
      '客服系统会话状态无效。',
    );
  }
  if (
    typeof item.unreadCount !== 'number' ||
    !Number.isInteger(item.unreadCount) ||
    item.unreadCount < 0 ||
    item.unreadCount > 9999
  ) {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_MESSAGES_RESPONSE',
      '客服系统未读消息数量无效。',
    );
  }
  return {
    id,
    agentName: nullableText(item.agentName, 160),
    agentAvatarUrl: safeHttpsUrl(item.agentAvatarUrl),
    productId,
    sectionId,
    productTitle,
    productCoverUrl: safeHttpsUrl(item.productCoverUrl),
    lastMessage: nullableText(item.lastMessage, 2000),
    lastMessageAt: nullableText(item.lastMessageAt, 80),
    unreadCount: item.unreadCount,
    status: item.status,
  };
}

function parseMessage(value: unknown): RemoteSupportMessage {
  const item = isRecord(value) ? value : null;
  const id = requiredText(item?.id, 400);
  const body = requiredText(item?.body, 4000);
  const sentAt = requiredText(item?.sentAt, 80);
  if (!item || !id || !body || !sentAt) {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_MESSAGES_RESPONSE',
      '客服系统消息接口返回格式无效。',
    );
  }
  if (item.direction !== 'customer' && item.direction !== 'agent') {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_MESSAGES_RESPONSE',
      '客服系统消息方向无效。',
    );
  }
  if (item.delivery !== 'sent' && item.delivery !== 'read') {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_MESSAGES_RESPONSE',
      '客服系统消息状态无效。',
    );
  }
  return {
    id,
    direction: item.direction,
    body,
    sentAt,
    delivery: item.delivery,
  };
}

function parseDetail(value: unknown): RemoteConversationDetail {
  const envelope = isRecord(value) ? value : null;
  const candidate = isRecord(envelope?.conversation) ? envelope.conversation : envelope;
  if (!candidate) {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_MESSAGES_RESPONSE',
      '客服系统会话详情返回格式无效。',
    );
  }
  const summary = parseSummary(candidate);
  const createdAt = requiredText(candidate.createdAt, 80);
  const expiresAt = requiredText(candidate.expiresAt, 80);
  const rawMessages = candidate.messages;
  if (!createdAt || !expiresAt || !Array.isArray(rawMessages)) {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_MESSAGES_RESPONSE',
      '客服系统会话详情返回格式无效。',
    );
  }
  const cursorValue = candidate.nextMessageCursor;
  const nextMessageCursor =
    cursorValue === null || cursorValue === undefined
      ? null
      : requiredText(cursorValue, 600);
  if (cursorValue !== null && cursorValue !== undefined && !nextMessageCursor) {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_MESSAGES_RESPONSE',
      '客服系统消息分页游标无效。',
    );
  }
  return {
    ...summary,
    createdAt,
    expiresAt,
    messages: rawMessages.map(parseMessage),
    nextMessageCursor,
  };
}

function messageHeaders(visitorId: string, requestId: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set('X-Site-Visitor-Id', visitorId);
  headers.set('X-Site-Request-Id', requestId);
  return headers;
}

export async function listRemoteSupportConversations(
  connection: CustomerServiceConnectionInternal,
  visitorId: string,
  requestId: string,
): Promise<RemoteConversationSummary[]> {
  const value = await customerServiceProviderFetchJson(connection, '/messages/v1/conversations', {
    headers: messageHeaders(visitorId, requestId),
  });
  const envelope = isRecord(value) ? value : null;
  if (!envelope || !Array.isArray(envelope.conversations)) {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_MESSAGES_RESPONSE',
      '客服系统会话列表返回格式无效。',
    );
  }
  return envelope.conversations.map(parseSummary);
}

export async function getRemoteSupportConversation(
  connection: CustomerServiceConnectionInternal,
  visitorId: string,
  requestId: string,
  remoteConversationId: string,
  before: string | null,
  limit: number,
): Promise<RemoteConversationDetail> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (before) query.set('before', before);
  const value = await customerServiceProviderFetchJson(
    connection,
    `/messages/v1/conversations/${encodeURIComponent(remoteConversationId)}?${query.toString()}`,
    { headers: messageHeaders(visitorId, requestId) },
  );
  return parseDetail(value);
}

export async function startRemoteSupportConversation(
  connection: CustomerServiceConnectionInternal,
  visitorId: string,
  requestId: string,
  input: StartRemoteConversationInput,
): Promise<RemoteConversationDetail> {
  const value = await customerServiceProviderFetchJson(connection, '/messages/v1/conversations', {
    method: 'POST',
    headers: messageHeaders(visitorId, requestId, {
      'Content-Type': 'application/json',
      'Idempotency-Key': input.clientMessageId,
    }),
    body: JSON.stringify({
      remoteGroupId: input.remoteGroupId,
      clientMessageId: input.clientMessageId,
      message: input.message,
      product: input.product,
    }),
  });
  return parseDetail(value);
}

export async function sendRemoteSupportMessage(
  connection: CustomerServiceConnectionInternal,
  visitorId: string,
  requestId: string,
  remoteConversationId: string,
  clientMessageId: string,
  body: string,
): Promise<RemoteSupportMessage> {
  const value = await customerServiceProviderFetchJson(
    connection,
    `/messages/v1/conversations/${encodeURIComponent(remoteConversationId)}/messages`,
    {
      method: 'POST',
      headers: messageHeaders(visitorId, requestId, {
        'Content-Type': 'application/json',
        'Idempotency-Key': clientMessageId,
      }),
      body: JSON.stringify({ clientMessageId, body }),
    },
  );
  const envelope = isRecord(value) ? value : null;
  return parseMessage(envelope?.message ?? value);
}

export async function markRemoteSupportConversationRead(
  connection: CustomerServiceConnectionInternal,
  visitorId: string,
  requestId: string,
  remoteConversationId: string,
  lastMessageId: string | null,
): Promise<void> {
  const value = await customerServiceProviderFetchJson(
    connection,
    `/messages/v1/conversations/${encodeURIComponent(remoteConversationId)}/read`,
    {
      method: 'POST',
      headers: messageHeaders(visitorId, requestId, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ lastMessageId }),
    },
  );
  const envelope = isRecord(value) ? value : null;
  if (!envelope || envelope.ok !== true) {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_MESSAGES_RESPONSE',
      '客服系统已读接口返回格式无效。',
    );
  }
}
