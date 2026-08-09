import { Hono, type Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { getConversionGroup, selectNextConversionTarget } from '../conversion-pool/conversion-pool';
import { getRoutableProduct } from '../conversion-pool/public-cta';
import {
  getCustomerServiceConnectionInternal,
  listEnabledCustomerServiceConnectionsInternal,
  type CustomerServiceConnectionInternal,
} from '../customer-service/customer-service-connections';
import { CustomerServiceProviderError } from '../customer-service/customer-service-provider';
import { apiError } from '../http/api-response';
import {
  getRemoteSupportConversation,
  listRemoteSupportConversations,
  markRemoteSupportConversationRead,
  sendRemoteSupportMessage,
  startRemoteSupportConversation,
  type RemoteConversationDetail,
  type RemoteConversationSummary,
} from '../messages/customer-service-messages';
import {
  MESSAGES_SESSION_COOKIE,
  MESSAGES_SESSION_TTL_SECONDS,
  createConversationRef,
  createMessageVisitorToken,
  getMessagesSessionSecret,
  parseConversationRef,
  verifyMessageVisitorToken,
  type MessageVisitorSession,
} from '../messages/messages-session';
import type { AppEnvironment } from '../types';

const MAX_BODY_BYTES = 12_000;
const DEFAULT_MESSAGE_PAGE_SIZE = 30;
const MAX_MESSAGE_PAGE_SIZE = 50;

export const publicMessagesRoutes = new Hono<AppEnvironment>();

function setPrivateHeaders(context: Context<AppEnvironment>) {
  context.header('Cache-Control', 'no-store, private');
  context.header('Pragma', 'no-cache');
  context.header('Referrer-Policy', 'no-referrer');
  context.header('X-Robots-Tag', 'noindex, nofollow');
}

publicMessagesRoutes.use('*', async (context, next) => {
  setPrivateHeaders(context);
  await next();
});

function messagesSecret(context: Context<AppEnvironment>): string | Response {
  const secret = getMessagesSessionSecret(context.env);
  return secret ?? apiError(
    context,
    503,
    'MESSAGES_NOT_CONFIGURED',
    'Messages is not configured yet.',
  );
}

function setVisitorCookie(context: Context<AppEnvironment>, token: string) {
  setCookie(context, MESSAGES_SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: new URL(context.req.url).protocol === 'https:',
    sameSite: 'Strict',
    maxAge: MESSAGES_SESSION_TTL_SECONDS,
  });
}

async function ensureVisitorSession(
  context: Context<AppEnvironment>,
  secret: string,
): Promise<MessageVisitorSession> {
  const existingToken = getCookie(context, MESSAGES_SESSION_COOKIE);
  if (existingToken) {
    const existing = await verifyMessageVisitorToken(existingToken, secret);
    if (existing) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const refreshWindow = 30 * 24 * 60 * 60;
      if (existing.expiresAt - nowSeconds <= refreshWindow) {
        const refreshed = await createMessageVisitorToken(secret, existing.visitorId);
        setVisitorCookie(context, refreshed.token);
        return refreshed.session;
      }
      return existing;
    }
  }
  const created = await createMessageVisitorToken(secret);
  setVisitorCookie(context, created.token);
  return created.session;
}

async function requireVisitorSession(
  context: Context<AppEnvironment>,
  secret: string,
): Promise<MessageVisitorSession | Response> {
  const token = getCookie(context, MESSAGES_SESSION_COOKIE);
  if (!token) {
    return apiError(context, 401, 'MESSAGES_SESSION_REQUIRED', 'Messages session is unavailable.');
  }
  const session = await verifyMessageVisitorToken(token, secret);
  return session ?? apiError(context, 401, 'MESSAGES_SESSION_INVALID', 'Messages session is invalid.');
}

function hasSafeOrigin(context: Context<AppEnvironment>): boolean {
  const origin = context.req.header('origin');
  return Boolean(origin && origin === new URL(context.req.url).origin);
}

async function readJsonBody(context: Context<AppEnvironment>): Promise<unknown | Response> {
  if (!hasSafeOrigin(context)) {
    return apiError(context, 403, 'MESSAGES_ORIGIN_REQUIRED', 'Messages request origin is invalid.');
  }
  const contentType = context.req.header('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return apiError(context, 400, 'INVALID_CONTENT_TYPE', 'Messages requests must use JSON.');
  }
  const contentLength = Number(context.req.header('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return apiError(context, 413, 'MESSAGES_BODY_TOO_LARGE', 'Messages request is too large.');
  }
  const text = await context.req.text();
  if (text.length > MAX_BODY_BYTES) {
    return apiError(context, 413, 'MESSAGES_BODY_TOO_LARGE', 'Messages request is too large.');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return apiError(context, 400, 'INVALID_JSON', 'Messages request JSON is invalid.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function readOptionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : undefined;
}

function messagePageLimit(raw: string | undefined): number {
  const value = Number(raw ?? DEFAULT_MESSAGE_PAGE_SIZE);
  if (!Number.isInteger(value) || value < 1) return DEFAULT_MESSAGE_PAGE_SIZE;
  return Math.min(value, MAX_MESSAGE_PAGE_SIZE);
}

function productHref(sectionId: string, productId: string): string {
  return `/sections/${encodeURIComponent(sectionId)}/products/${encodeURIComponent(productId)}/`;
}

async function normalizeSummary(
  secret: string,
  visitorId: string,
  connectionId: string,
  remote: RemoteConversationSummary,
) {
  return {
    id: await createConversationRef(secret, visitorId, connectionId, remote.id),
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

async function normalizeDetail(
  secret: string,
  visitorId: string,
  connectionId: string,
  remote: RemoteConversationDetail,
) {
  return {
    ...(await normalizeSummary(secret, visitorId, connectionId, remote)),
    productHref: productHref(remote.sectionId, remote.productId),
    createdAt: remote.createdAt,
    expiresAt: remote.expiresAt,
    messages: remote.messages,
    nextMessageCursor: remote.nextMessageCursor,
  };
}

function providerFailure(context: Context<AppEnvironment>, error: unknown) {
  const code = error instanceof CustomerServiceProviderError
    ? error.code
    : 'CUSTOMER_SERVICE_UNKNOWN_ERROR';
  console.warn(JSON.stringify({
    level: 'warn',
    event: 'messages.provider_failed',
    requestId: context.get('requestId'),
    providerCode: code,
  }));
  return apiError(context, 502, 'MESSAGES_PROVIDER_UNAVAILABLE', 'Messages is temporarily unavailable.');
}

async function resolveConversationConnection(
  context: Context<AppEnvironment>,
  secret: string,
  visitorId: string,
  conversationRef: string,
): Promise<{
  connection: CustomerServiceConnectionInternal;
  remoteConversationId: string;
} | Response> {
  const parsed = await parseConversationRef(secret, visitorId, conversationRef);
  if (!parsed) {
    return apiError(context, 404, 'MESSAGE_CONVERSATION_NOT_FOUND', 'Conversation not found.');
  }
  const connection = await getCustomerServiceConnectionInternal(context.env.DB, parsed.connectionId);
  if (!connection || connection.deletedAt || !connection.isEnabled) {
    return apiError(context, 404, 'MESSAGE_CONVERSATION_NOT_FOUND', 'Conversation not found.');
  }
  return { connection, remoteConversationId: parsed.remoteConversationId };
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

publicMessagesRoutes.get('/conversations', async (context) => {
  const secretValue = messagesSecret(context);
  if (isResponse(secretValue)) return secretValue;
  const session = await ensureVisitorSession(context, secretValue);
  const connections = await listEnabledCustomerServiceConnectionsInternal(context.env.DB);
  if (connections.length === 0) return context.json({ conversations: [] });

  const settled = await Promise.allSettled(
    connections.map(async (connection) => ({
      connection,
      conversations: await listRemoteSupportConversations(
        connection,
        session.visitorId,
        context.get('requestId'),
      ),
    })),
  );
  const successful = settled.filter(
    (result): result is PromiseFulfilledResult<{
      connection: CustomerServiceConnectionInternal;
      conversations: RemoteConversationSummary[];
    }> => result.status === 'fulfilled',
  );
  const failed = settled.filter((result) => result.status === 'rejected');
  for (const failure of failed) {
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'messages.list_provider_failed',
      requestId: context.get('requestId'),
      errorName: failure.reason instanceof Error ? failure.reason.name : 'UnknownError',
    }));
  }
  if (successful.length === 0 && failed.length > 0) {
    return apiError(context, 502, 'MESSAGES_PROVIDER_UNAVAILABLE', 'Messages is temporarily unavailable.');
  }

  const conversations = (
    await Promise.all(
      successful.flatMap(({ value }) =>
        value.conversations.map((conversation) =>
          normalizeSummary(secretValue, session.visitorId, value.connection.id, conversation),
        ),
      ),
    )
  ).sort((left, right) => {
    const rightTime = right.lastMessageAt ? Date.parse(right.lastMessageAt) : 0;
    const leftTime = left.lastMessageAt ? Date.parse(left.lastMessageAt) : 0;
    return rightTime - leftTime;
  });
  return context.json({ conversations });
});

publicMessagesRoutes.get('/conversations/:conversationRef', async (context) => {
  const secretValue = messagesSecret(context);
  if (isResponse(secretValue)) return secretValue;
  const session = await requireVisitorSession(context, secretValue);
  if (isResponse(session)) return session;
  const resolved = await resolveConversationConnection(
    context,
    secretValue,
    session.visitorId,
    context.req.param('conversationRef'),
  );
  if (isResponse(resolved)) return resolved;
  const before = readOptionalText(context.req.query('before'), 600);
  if (before === undefined) {
    return apiError(context, 400, 'INVALID_MESSAGE_CURSOR', 'Message cursor is invalid.');
  }
  try {
    const remote = await getRemoteSupportConversation(
      resolved.connection,
      session.visitorId,
      context.get('requestId'),
      resolved.remoteConversationId,
      before,
      messagePageLimit(context.req.query('limit')),
    );
    return context.json({
      conversation: await normalizeDetail(
        secretValue,
        session.visitorId,
        resolved.connection.id,
        remote,
      ),
    });
  } catch (error) {
    return providerFailure(context, error);
  }
});

publicMessagesRoutes.post('/conversations', async (context) => {
  const secretValue = messagesSecret(context);
  if (isResponse(secretValue)) return secretValue;
  const body = await readJsonBody(context);
  if (isResponse(body)) return body;
  if (!isRecord(body)) {
    return apiError(context, 400, 'INVALID_MESSAGE_REQUEST', 'Message request is invalid.');
  }
  const productId = readRequiredText(body.productId, 120);
  const sectionId = readRequiredText(body.sectionId, 120);
  const message = readRequiredText(body.message, 4000);
  const clientMessageId = readRequiredText(body.clientMessageId, 120);
  if (!productId || !sectionId || !message || !clientMessageId) {
    return apiError(context, 400, 'INVALID_MESSAGE_REQUEST', 'Message request is invalid.');
  }
  const session = await ensureVisitorSession(context, secretValue);
  const product = await getRoutableProduct(context.env.DB, productId);
  if (!product || product.sectionId !== sectionId || !product.conversionGroupId) {
    return apiError(context, 404, 'MESSAGE_PRODUCT_NOT_FOUND', 'This product is unavailable.');
  }
  const group = await getConversionGroup(context.env.DB, sectionId, product.conversionGroupId);
  if (
    !group ||
    group.deletedAt ||
    !group.isEnabled ||
    group.mode !== 'customer_service' ||
    group.activeTargetCount < 1
  ) {
    return apiError(context, 409, 'MESSAGE_SUPPORT_UNAVAILABLE', 'Customer service is unavailable.');
  }
  const target = await selectNextConversionTarget(context.env.DB, group, new Date().toISOString());
  if (
    !target ||
    target.bindingKind !== 'customer_service' ||
    !target.customerServiceConnectionId ||
    !target.remoteGroupId
  ) {
    return apiError(context, 409, 'MESSAGE_SUPPORT_UNAVAILABLE', 'Customer service is unavailable.');
  }
  const connection = await getCustomerServiceConnectionInternal(
    context.env.DB,
    target.customerServiceConnectionId,
  );
  if (!connection || connection.deletedAt || !connection.isEnabled) {
    return apiError(context, 409, 'MESSAGE_SUPPORT_UNAVAILABLE', 'Customer service is unavailable.');
  }
  try {
    const remote = await startRemoteSupportConversation(
      connection,
      session.visitorId,
      context.get('requestId'),
      {
        remoteGroupId: target.remoteGroupId,
        clientMessageId,
        message,
        product: {
          id: product.id,
          sectionId: product.sectionId,
          title: product.title,
          href: productHref(product.sectionId, product.id),
          coverUrl: null,
        },
      },
    );
    if (remote.productId !== product.id || remote.sectionId !== product.sectionId) {
      throw new CustomerServiceProviderError(
        'CUSTOMER_SERVICE_INVALID_MESSAGES_RESPONSE',
        '客服系统返回了错误的产品上下文。',
      );
    }
    return context.json({
      conversation: await normalizeDetail(secretValue, session.visitorId, connection.id, remote),
    }, 201);
  } catch (error) {
    return providerFailure(context, error);
  }
});

publicMessagesRoutes.post('/conversations/:conversationRef/messages', async (context) => {
  const secretValue = messagesSecret(context);
  if (isResponse(secretValue)) return secretValue;
  const session = await requireVisitorSession(context, secretValue);
  if (isResponse(session)) return session;
  const body = await readJsonBody(context);
  if (isResponse(body)) return body;
  if (!isRecord(body)) {
    return apiError(context, 400, 'INVALID_MESSAGE_REQUEST', 'Message request is invalid.');
  }
  const clientMessageId = readRequiredText(body.clientMessageId, 120);
  const messageBody = readRequiredText(body.body, 4000);
  if (!clientMessageId || !messageBody) {
    return apiError(context, 400, 'INVALID_MESSAGE_REQUEST', 'Message request is invalid.');
  }
  const resolved = await resolveConversationConnection(
    context,
    secretValue,
    session.visitorId,
    context.req.param('conversationRef'),
  );
  if (isResponse(resolved)) return resolved;
  try {
    const message = await sendRemoteSupportMessage(
      resolved.connection,
      session.visitorId,
      context.get('requestId'),
      resolved.remoteConversationId,
      clientMessageId,
      messageBody,
    );
    return context.json({ message });
  } catch (error) {
    return providerFailure(context, error);
  }
});

publicMessagesRoutes.post('/conversations/:conversationRef/read', async (context) => {
  const secretValue = messagesSecret(context);
  if (isResponse(secretValue)) return secretValue;
  const session = await requireVisitorSession(context, secretValue);
  if (isResponse(session)) return session;
  const body = await readJsonBody(context);
  if (isResponse(body)) return body;
  if (!isRecord(body)) {
    return apiError(context, 400, 'INVALID_MESSAGE_REQUEST', 'Message request is invalid.');
  }
  const lastMessageId = readOptionalText(body.lastMessageId, 400);
  if (lastMessageId === undefined) {
    return apiError(context, 400, 'INVALID_MESSAGE_REQUEST', 'Message request is invalid.');
  }
  const resolved = await resolveConversationConnection(
    context,
    secretValue,
    session.visitorId,
    context.req.param('conversationRef'),
  );
  if (isResponse(resolved)) return resolved;
  try {
    await markRemoteSupportConversationRead(
      resolved.connection,
      session.visitorId,
      context.get('requestId'),
      resolved.remoteConversationId,
      lastMessageId,
    );
    return context.json({ ok: true });
  } catch (error) {
    return providerFailure(context, error);
  }
});
