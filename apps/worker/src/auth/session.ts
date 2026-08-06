import { constantTimeEqual, decodeJsonPayload, encodeJsonPayload, hmacSha256Base64Url } from './crypto';
import type { AdminSession } from '../types';

export const ADMIN_SESSION_COOKIE = 'site_admin_session';
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;

function isAdminSession(value: unknown): value is AdminSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === 1 &&
    typeof candidate.issuedAt === 'number' &&
    Number.isInteger(candidate.issuedAt) &&
    typeof candidate.expiresAt === 'number' &&
    Number.isInteger(candidate.expiresAt) &&
    typeof candidate.nonce === 'string' &&
    candidate.nonce.length > 0
  );
}

export async function createAdminSessionToken(
  secret: string,
  now = Date.now(),
): Promise<{ token: string; session: AdminSession }> {
  const issuedAt = Math.floor(now / 1000);
  const session: AdminSession = {
    version: 1,
    issuedAt,
    expiresAt: issuedAt + ADMIN_SESSION_TTL_SECONDS,
    nonce: crypto.randomUUID(),
  };
  const payload = encodeJsonPayload(session);
  const signature = await hmacSha256Base64Url(secret, payload);

  return { token: `${payload}.${signature}`, session };
}

export async function verifyAdminSessionToken(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<AdminSession | null> {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [payload, suppliedSignature] = parts;
  if (!payload || !suppliedSignature) {
    return null;
  }

  const expectedSignature = await hmacSha256Base64Url(secret, payload);
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) {
    return null;
  }

  const decoded = decodeJsonPayload(payload);
  if (!isAdminSession(decoded)) {
    return null;
  }

  const nowSeconds = Math.floor(now / 1000);
  const lifetime = decoded.expiresAt - decoded.issuedAt;
  if (
    decoded.issuedAt > nowSeconds + 60 ||
    decoded.expiresAt <= nowSeconds ||
    lifetime <= 0 ||
    lifetime > ADMIN_SESSION_TTL_SECONDS + 60
  ) {
    return null;
  }

  return decoded;
}
