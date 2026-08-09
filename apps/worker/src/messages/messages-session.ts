import {
  constantTimeEqual,
  decodeJsonPayload,
  encodeJsonPayload,
  hmacSha256Base64Url,
} from '../auth/crypto';
import type { AppBindings } from '../types';

export const MESSAGES_SESSION_COOKIE = 'site_messages_session';
export const MESSAGES_SESSION_TTL_SECONDS = 180 * 24 * 60 * 60;

export type MessageVisitorSession = {
  visitorId: string;
  issuedAt: number;
  expiresAt: number;
};

type VisitorTokenPayload = MessageVisitorSession & { version: 1 };

type ConversationRefPayload = {
  version: 1;
  visitorId: string;
  connectionId: string;
  remoteConversationId: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export function getMessagesSessionSecret(bindings: AppBindings): string | null {
  const secret = bindings.MESSAGES_SESSION_SECRET?.trim() ?? '';
  return secret.length >= 32 ? secret : null;
}

function validVisitorPayload(value: unknown): value is VisitorTokenPayload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === 1 &&
    typeof candidate.visitorId === 'string' &&
    candidate.visitorId.length >= 16 &&
    candidate.visitorId.length <= 120 &&
    typeof candidate.issuedAt === 'number' &&
    Number.isInteger(candidate.issuedAt) &&
    typeof candidate.expiresAt === 'number' &&
    Number.isInteger(candidate.expiresAt)
  );
}

export async function createMessageVisitorToken(
  secret: string,
  visitorId = crypto.randomUUID(),
  now = Date.now(),
): Promise<{ token: string; session: MessageVisitorSession }> {
  const issuedAt = Math.floor(now / 1000);
  const payload: VisitorTokenPayload = {
    version: 1,
    visitorId,
    issuedAt,
    expiresAt: issuedAt + MESSAGES_SESSION_TTL_SECONDS,
  };
  const encoded = encodeJsonPayload(payload);
  const signature = await hmacSha256Base64Url(`${secret}:visitor`, encoded);
  return {
    token: `${encoded}.${signature}`,
    session: {
      visitorId: payload.visitorId,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    },
  };
}

export async function verifyMessageVisitorToken(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<MessageVisitorSession | null> {
  const [payload, suppliedSignature, extra] = token.split('.');
  if (!payload || !suppliedSignature || extra !== undefined) return null;
  const expectedSignature = await hmacSha256Base64Url(`${secret}:visitor`, payload);
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) return null;
  const decoded = decodeJsonPayload(payload);
  if (!validVisitorPayload(decoded)) return null;
  const nowSeconds = Math.floor(now / 1000);
  const lifetime = decoded.expiresAt - decoded.issuedAt;
  if (
    decoded.issuedAt > nowSeconds + 60 ||
    decoded.expiresAt <= nowSeconds ||
    lifetime <= 0 ||
    lifetime > MESSAGES_SESSION_TTL_SECONDS + 60
  ) {
    return null;
  }
  return {
    visitorId: decoded.visitorId,
    issuedAt: decoded.issuedAt,
    expiresAt: decoded.expiresAt,
  };
}

async function conversationKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`${secret}:conversation-ref`),
  );
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function createConversationRef(
  secret: string,
  visitorId: string,
  connectionId: string,
  remoteConversationId: string,
): Promise<string> {
  const payload: ConversationRefPayload = {
    version: 1,
    visitorId,
    connectionId,
    remoteConversationId,
  };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await conversationKey(secret),
      encoder.encode(JSON.stringify(payload)),
    ),
  );
  const output = new Uint8Array(iv.length + ciphertext.length);
  output.set(iv, 0);
  output.set(ciphertext, iv.length);
  return bytesToBase64Url(output);
}

export async function parseConversationRef(
  secret: string,
  visitorId: string,
  conversationRef: string,
): Promise<{ connectionId: string; remoteConversationId: string } | null> {
  if (!conversationRef || conversationRef.length > 1000) return null;
  const bytes = base64UrlToBytes(conversationRef);
  if (!bytes || bytes.length <= 28) return null;
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      await conversationKey(secret),
      ciphertext,
    );
    const value = JSON.parse(decoder.decode(plaintext)) as unknown;
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Record<string, unknown>;
    if (
      candidate.version !== 1 ||
      candidate.visitorId !== visitorId ||
      typeof candidate.connectionId !== 'string' ||
      !candidate.connectionId ||
      candidate.connectionId.length > 120 ||
      typeof candidate.remoteConversationId !== 'string' ||
      !candidate.remoteConversationId ||
      candidate.remoteConversationId.length > 400
    ) {
      return null;
    }
    return {
      connectionId: candidate.connectionId,
      remoteConversationId: candidate.remoteConversationId,
    };
  } catch {
    return null;
  }
}
