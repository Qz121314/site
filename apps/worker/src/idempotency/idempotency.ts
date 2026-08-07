type IdempotencyRow = {
  response_body: string;
};

const PRUNE_BATCH_SIZE = 250;

export function normalizeIdempotencyKey(value: string | undefined): string | null {
  if (!value || value.length > 128) {
    return null;
  }

  return value;
}

function storageKey(scope: string, key: string): string {
  return `${scope}:${key}`;
}

export async function pruneExpiredIdempotencyKeys(
  db: D1Database,
  now: string,
): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM idempotency_keys
       WHERE key IN (
         SELECT key
         FROM idempotency_keys
         WHERE expires_at <= ?
         ORDER BY expires_at ASC
         LIMIT ?
       )`,
    )
    .bind(now, PRUNE_BATCH_SIZE)
    .run();

  return result.meta.changes;
}

export async function readIdempotentResponse(
  db: D1Database,
  scope: string,
  key: string,
  now: string,
): Promise<unknown | null> {
  await pruneExpiredIdempotencyKeys(db, now);

  const row = await db
    .prepare(
      `SELECT response_body
       FROM idempotency_keys
       WHERE key = ? AND scope = ? AND expires_at > ?`,
    )
    .bind(storageKey(scope, key), scope, now)
    .first<IdempotencyRow>();

  if (!row) {
    return null;
  }

  try {
    return JSON.parse(row.response_body) as unknown;
  } catch {
    return null;
  }
}

export function createIdempotencyStatement(
  db: D1Database,
  scope: string,
  key: string,
  responseBody: Record<string, unknown>,
  now: string,
  responseStatus = 200,
): D1PreparedStatement {
  const expiresAt = new Date(Date.parse(now) + 24 * 60 * 60 * 1000).toISOString();

  return db
    .prepare(
      `INSERT INTO idempotency_keys (
         key, scope, response_status, response_body, expires_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         scope = excluded.scope,
         response_status = excluded.response_status,
         response_body = excluded.response_body,
         expires_at = excluded.expires_at,
         created_at = excluded.created_at`,
    )
    .bind(
      storageKey(scope, key),
      scope,
      responseStatus,
      JSON.stringify(responseBody),
      expiresAt,
      now,
    );
}
