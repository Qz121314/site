import { sha256Base64Url } from './crypto';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const LOGIN_RECORD_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

type LoginRateLimitRow = {
  failed_count: number;
  blocked_until: string | null;
};

export type LoginRateLimitStatus = {
  blocked: boolean;
  retryAfterSeconds: number;
};

export async function createLoginRateLimitKey(
  clientAddress: string,
  sessionSecret: string,
): Promise<string> {
  return sha256Base64Url(`${clientAddress}:${sessionSecret}`);
}

export async function pruneExpiredLoginRateLimits(db: D1Database, now: Date): Promise<void> {
  await db
    .prepare('DELETE FROM admin_login_rate_limits WHERE expires_at <= ?')
    .bind(now.toISOString())
    .run();
}

export async function getLoginRateLimitStatus(
  db: D1Database,
  keyHash: string,
  now: Date,
): Promise<LoginRateLimitStatus> {
  const record = await db
    .prepare(
      `SELECT blocked_until
       FROM admin_login_rate_limits
       WHERE key_hash = ? AND expires_at > ?`,
    )
    .bind(keyHash, now.toISOString())
    .first<{ blocked_until: string | null }>();

  if (!record?.blocked_until) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  const blockedUntil = Date.parse(record.blocked_until);
  if (!Number.isFinite(blockedUntil) || blockedUntil <= now.getTime()) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  return {
    blocked: true,
    retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil - now.getTime()) / 1000)),
  };
}

export async function recordFailedLogin(
  db: D1Database,
  keyHash: string,
  now: Date,
): Promise<LoginRateLimitStatus> {
  const nowIso = now.toISOString();
  const resetBeforeIso = new Date(now.getTime() - LOGIN_WINDOW_MS).toISOString();
  const blockedUntilIso = new Date(now.getTime() + LOGIN_BLOCK_MS).toISOString();
  const expiresAtIso = new Date(now.getTime() + LOGIN_RECORD_TTL_MS).toISOString();

  const record = await db
    .prepare(
      `INSERT INTO admin_login_rate_limits (
         key_hash,
         failed_count,
         window_started_at,
         blocked_until,
         expires_at,
         updated_at
       ) VALUES (?, 1, ?, NULL, ?, ?)
       ON CONFLICT(key_hash) DO UPDATE SET
         failed_count = CASE
           WHEN admin_login_rate_limits.window_started_at <= ? THEN 1
           ELSE admin_login_rate_limits.failed_count + 1
         END,
         window_started_at = CASE
           WHEN admin_login_rate_limits.window_started_at <= ? THEN excluded.window_started_at
           ELSE admin_login_rate_limits.window_started_at
         END,
         blocked_until = CASE
           WHEN admin_login_rate_limits.window_started_at <= ? THEN NULL
           WHEN admin_login_rate_limits.failed_count + 1 >= ? THEN ?
           ELSE admin_login_rate_limits.blocked_until
         END,
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at
       RETURNING failed_count, blocked_until`,
    )
    .bind(
      keyHash,
      nowIso,
      expiresAtIso,
      nowIso,
      resetBeforeIso,
      resetBeforeIso,
      resetBeforeIso,
      MAX_FAILED_ATTEMPTS,
      blockedUntilIso,
    )
    .first<LoginRateLimitRow>();

  if (!record) {
    throw new Error('Failed to persist admin login rate limit state.');
  }

  if (!record.blocked_until) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  return {
    blocked: true,
    retryAfterSeconds: LOGIN_BLOCK_MS / 1000,
  };
}

export async function clearLoginRateLimit(db: D1Database, keyHash: string): Promise<void> {
  await db.prepare('DELETE FROM admin_login_rate_limits WHERE key_hash = ?').bind(keyHash).run();
}
