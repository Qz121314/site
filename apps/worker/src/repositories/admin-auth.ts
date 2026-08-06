import type { Permission } from '../../../../packages/shared/src/domain';
import { isPermission } from '../../../../packages/shared/src/domain';
import type { AdminSession } from '../types';

export type AdminUserAuthRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  status: 'active' | 'disabled';
};

type AdminSessionRow = {
  session_id: string;
  expires_at: number;
  last_seen_at: number;
  admin_user_id: string;
  email: string;
  display_name: string;
  status: 'active' | 'disabled';
};

type PermissionRow = {
  role_key: string;
  permission_key: string;
};

type RateLimitRow = {
  window_started_at: number;
  attempt_count: number;
};

export async function findAdminByEmail(
  database: D1Database,
  normalizedEmail: string,
): Promise<AdminUserAuthRow | null> {
  return database
    .prepare(
      `SELECT id, email, display_name, password_hash, password_salt, password_iterations, status
       FROM admin_users
       WHERE normalized_email = ?1 AND deleted_at IS NULL
       LIMIT 1`,
    )
    .bind(normalizedEmail)
    .first<AdminUserAuthRow>();
}

export async function createAdminSession(
  database: D1Database,
  input: {
    id: string;
    tokenHash: string;
    adminUserId: string;
    expiresAt: number;
    userAgentHash: string | null;
    createdAt: number;
  },
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO admin_sessions (
        id, token_hash, admin_user_id, expires_at, last_seen_at, user_agent_hash, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?5)`,
    )
    .bind(
      input.id,
      input.tokenHash,
      input.adminUserId,
      input.expiresAt,
      input.createdAt,
      input.userAgentHash,
    )
    .run();
}

export async function resolveAdminSession(
  database: D1Database,
  tokenHash: string,
  now: number,
): Promise<AdminSession | null> {
  const session = await database
    .prepare(
      `SELECT
        s.id AS session_id,
        s.expires_at,
        s.last_seen_at,
        u.id AS admin_user_id,
        u.email,
        u.display_name,
        u.status
       FROM admin_sessions s
       INNER JOIN admin_users u ON u.id = s.admin_user_id
       WHERE s.token_hash = ?1
         AND s.revoked_at IS NULL
         AND s.expires_at > ?2
         AND u.deleted_at IS NULL
       LIMIT 1`,
    )
    .bind(tokenHash, now)
    .first<AdminSessionRow>();

  if (!session || session.status !== 'active') {
    return null;
  }

  const permissionResult = await database
    .prepare(
      `SELECT DISTINCT ur.role_key, rp.permission_key
       FROM admin_user_roles ur
       INNER JOIN role_permissions rp ON rp.role_key = ur.role_key
       WHERE ur.admin_user_id = ?1
       ORDER BY ur.role_key, rp.permission_key`,
    )
    .bind(session.admin_user_id)
    .all<PermissionRow>();

  const roleKeys = new Set<string>();
  const grantedPermissions = new Set<Permission>();

  for (const row of permissionResult.results) {
    roleKeys.add(row.role_key);
    if (isPermission(row.permission_key)) {
      grantedPermissions.add(row.permission_key);
    }
  }

  return {
    sessionId: session.session_id,
    expiresAt: session.expires_at,
    lastSeenAt: session.last_seen_at,
    id: session.admin_user_id,
    email: session.email,
    displayName: session.display_name,
    status: session.status,
    roleKeys: [...roleKeys],
    permissions: [...grantedPermissions],
  };
}

export async function touchAdminSession(
  database: D1Database,
  sessionId: string,
  now: number,
): Promise<void> {
  await database
    .prepare('UPDATE admin_sessions SET last_seen_at = ?1 WHERE id = ?2')
    .bind(now, sessionId)
    .run();
}

export async function revokeAdminSession(
  database: D1Database,
  sessionId: string,
  now: number,
): Promise<void> {
  await database
    .prepare('UPDATE admin_sessions SET revoked_at = ?1 WHERE id = ?2 AND revoked_at IS NULL')
    .bind(now, sessionId)
    .run();
}

export async function consumeLoginAttempt(
  database: D1Database,
  rateKey: string,
  now: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const windowSeconds = 15 * 60;
  const maximumAttempts = 10;
  const row = await database
    .prepare('SELECT window_started_at, attempt_count FROM auth_rate_limits WHERE rate_key = ?1')
    .bind(rateKey)
    .first<RateLimitRow>();

  if (!row || row.window_started_at <= now - windowSeconds) {
    await database
      .prepare(
        `INSERT INTO auth_rate_limits (rate_key, window_started_at, attempt_count, updated_at)
         VALUES (?1, ?2, 1, ?2)
         ON CONFLICT(rate_key) DO UPDATE SET
           window_started_at = excluded.window_started_at,
           attempt_count = 1,
           updated_at = excluded.updated_at`,
      )
      .bind(rateKey, now)
      .run();
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.max(1, row.window_started_at + windowSeconds - now);
  if (row.attempt_count >= maximumAttempts) {
    return { allowed: false, retryAfterSeconds };
  }

  await database
    .prepare(
      'UPDATE auth_rate_limits SET attempt_count = attempt_count + 1, updated_at = ?1 WHERE rate_key = ?2',
    )
    .bind(now, rateKey)
    .run();

  return { allowed: true, retryAfterSeconds: 0 };
}

export async function clearLoginAttempts(database: D1Database, rateKey: string): Promise<void> {
  await database.prepare('DELETE FROM auth_rate_limits WHERE rate_key = ?1').bind(rateKey).run();
}

export async function writeAuditLog(
  database: D1Database,
  input: {
    id: string;
    actorAdminUserId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    requestId: string;
    ipHash: string | null;
    userAgentHash: string | null;
    metadata: Record<string, unknown>;
    createdAt: number;
  },
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO audit_logs (
        id, actor_admin_user_id, action, entity_type, entity_id,
        request_id, ip_hash, user_agent_hash, metadata_json, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    )
    .bind(
      input.id,
      input.actorAdminUserId,
      input.action,
      input.entityType,
      input.entityId,
      input.requestId,
      input.ipHash,
      input.userAgentHash,
      JSON.stringify(input.metadata),
      input.createdAt,
    )
    .run();
}

export type AuditLogRow = {
  id: string;
  actor_admin_user_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  request_id: string;
  metadata_json: string;
  created_at: number;
};

export async function listAuditLogs(
  database: D1Database,
  limit: number,
): Promise<AuditLogRow[]> {
  const result = await database
    .prepare(
      `SELECT
        a.id,
        a.actor_admin_user_id,
        u.email AS actor_email,
        a.action,
        a.entity_type,
        a.entity_id,
        a.request_id,
        a.metadata_json,
        a.created_at
       FROM audit_logs a
       LEFT JOIN admin_users u ON u.id = a.actor_admin_user_id
       ORDER BY a.created_at DESC
       LIMIT ?1`,
    )
    .bind(limit)
    .all<AuditLogRow>();

  return result.results;
}
