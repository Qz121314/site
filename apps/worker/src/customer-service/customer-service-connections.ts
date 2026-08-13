export type CustomerServiceScope = 'active' | 'trash' | 'all';
export type CustomerServiceProvider = 'generic_v1';

export type CustomerServiceConnectionRecord = {
  id: string;
  name: string;
  provider: CustomerServiceProvider;
  baseUrl: string;
  hasVerifyToken: boolean;
  clientApiUrl: string | null;
  realtimeUrl: string | null;
  verifiedAt: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  targetCount: number;
};

export type CustomerServiceConnectionInput = {
  name: string;
  provider: CustomerServiceProvider;
  baseUrl: string;
  verifyToken?: string | null;
  isEnabled: boolean;
};

export type CustomerServiceConnectionInternal = CustomerServiceConnectionRecord & {
  verifyToken: string | null;
};

type ConnectionRow = {
  id: string;
  name: string;
  provider: string;
  base_url: string;
  api_token: string | null;
  client_api_url: string | null;
  realtime_url: string | null;
  verified_at: string | null;
  is_enabled: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  target_count: number;
};

type ValidationResult =
  | { ok: true; value: CustomerServiceConnectionInput }
  | { ok: false; field: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(
  value: unknown,
  field: string,
  label: string,
  maxLength: number,
  required: true,
): { ok: true; value: string } | { ok: false; field: string; message: string };
function readText(
  value: unknown,
  field: string,
  label: string,
  maxLength: number,
  required: false,
): { ok: true; value: string | null } | { ok: false; field: string; message: string };
function readText(
  value: unknown,
  field: string,
  label: string,
  maxLength: number,
  required: boolean,
) {
  if (value === null || value === undefined || value === '') {
    return required
      ? { ok: false as const, field, message: `请填写${label}。` }
      : { ok: true as const, value: null };
  }
  if (typeof value !== 'string') {
    return { ok: false as const, field, message: `${label}必须是文本。` };
  }
  const normalized = value.trim();
  if (!normalized) {
    return required
      ? { ok: false as const, field, message: `请填写${label}。` }
      : { ok: true as const, value: null };
  }
  if (normalized.length > maxLength) {
    return {
      ok: false as const,
      field,
      message: `${label}不能超过 ${maxLength} 个字符。`,
    };
  }
  return { ok: true as const, value: normalized };
}

function isIpAddress(hostname: string): boolean {
  if (hostname.includes(':')) return true;
  const parts = hostname.split('.');
  return (
    parts.length === 4 &&
    parts.every(
      (part) => /^\d{1,3}$/u.test(part) && Number(part) >= 0 && Number(part) <= 255,
    )
  );
}

function normalizeBaseUrl(value: unknown) {
  const raw = readText(value, 'baseUrl', '客服系统公网地址', 1000, true);
  if (!raw.ok) return raw;
  let url: URL;
  try {
    url = new URL(raw.value);
  } catch {
    return {
      ok: false as const,
      field: 'baseUrl',
      message: '客服系统公网地址格式无效。',
    };
  }
  if (url.protocol !== 'https:') {
    return {
      ok: false as const,
      field: 'baseUrl',
      message: '客服系统公网地址必须使用 HTTPS。',
    };
  }
  if (url.username || url.password || url.search || url.hash) {
    return {
      ok: false as const,
      field: 'baseUrl',
      message: '客服系统公网地址不能包含账号、查询参数或锚点。',
    };
  }
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    !hostname.includes('.') ||
    isIpAddress(hostname)
  ) {
    return {
      ok: false as const,
      field: 'baseUrl',
      message: '客服系统必须使用公开 HTTPS 域名。',
    };
  }
  return { ok: true as const, value: url.toString().replace(/\/$/u, '') };
}

export function validateCustomerServiceConnectionInput(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, field: 'form', message: '客服系统连接数据无效。' };
  }
  const name = readText(value.name, 'name', '连接名称', 120, true);
  if (!name.ok) return name;
  if (value.provider !== 'generic_v1') {
    return { ok: false, field: 'provider', message: '当前只支持标准客服接口 v1。' };
  }
  const baseUrl = normalizeBaseUrl(value.baseUrl);
  if (!baseUrl.ok) return baseUrl;

  let verifyToken: string | null | undefined;
  if (Object.hasOwn(value, 'verifyToken')) {
    const token = readText(value.verifyToken, 'verifyToken', '验证 Token', 4000, false);
    if (!token.ok) return token;
    verifyToken = token.value;
  }
  if (typeof value.isEnabled !== 'boolean') {
    return { ok: false, field: 'isEnabled', message: '必须选择启用或停用。' };
  }
  return {
    ok: true,
    value: {
      name: name.value,
      provider: 'generic_v1',
      baseUrl: baseUrl.value,
      ...(verifyToken !== undefined ? { verifyToken } : {}),
      isEnabled: value.isEnabled,
    },
  };
}

const CONNECTION_SELECT = `SELECT
  c.id,
  c.name,
  c.provider,
  c.base_url,
  c.api_token,
  c.client_api_url,
  c.realtime_url,
  c.verified_at,
  c.is_enabled,
  c.created_at,
  c.updated_at,
  c.deleted_at,
  (SELECT COUNT(*) FROM conversion_groups g
    WHERE g.customer_service_connection_id = c.id
      AND g.mode = 'customer_service'
      AND g.deleted_at IS NULL) AS target_count
FROM customer_service_connections c`;

function mapConnection(row: ConnectionRow): CustomerServiceConnectionInternal {
  if (row.provider !== 'generic_v1') {
    throw new Error(`UNSUPPORTED_CUSTOMER_SERVICE_PROVIDER:${row.provider}`);
  }
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    baseUrl: row.base_url,
    verifyToken: row.api_token,
    hasVerifyToken: Boolean(row.api_token),
    clientApiUrl: row.client_api_url,
    realtimeUrl: row.realtime_url,
    verifiedAt: row.verified_at,
    isEnabled: row.is_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    targetCount: row.target_count,
  };
}

export function toPublicCustomerServiceConnection(
  connection: CustomerServiceConnectionInternal,
): CustomerServiceConnectionRecord {
  const { verifyToken: _verifyToken, ...publicConnection } = connection;
  return publicConnection;
}

export async function listCustomerServiceConnections(
  db: D1Database,
  scope: CustomerServiceScope,
): Promise<CustomerServiceConnectionRecord[]> {
  const clause =
    scope === 'active'
      ? 'WHERE c.deleted_at IS NULL'
      : scope === 'trash'
        ? 'WHERE c.deleted_at IS NOT NULL'
        : '';
  const rows = (
    await db
      .prepare(`${CONNECTION_SELECT} ${clause} ORDER BY c.name COLLATE NOCASE ASC`)
      .all<ConnectionRow>()
  ).results;
  return rows.map(mapConnection).map(toPublicCustomerServiceConnection);
}

export async function listEnabledCustomerServiceConnectionsInternal(
  db: D1Database,
): Promise<CustomerServiceConnectionInternal[]> {
  const rows = (
    await db
      .prepare(
        `${CONNECTION_SELECT}
         WHERE c.deleted_at IS NULL AND c.is_enabled = 1
         ORDER BY c.name COLLATE NOCASE ASC`,
      )
      .all<ConnectionRow>()
  ).results;
  return rows.map(mapConnection);
}

export async function getCustomerServiceConnectionInternal(
  db: D1Database,
  id: string,
): Promise<CustomerServiceConnectionInternal | null> {
  const row = await db
    .prepare(`${CONNECTION_SELECT} WHERE c.id = ?`)
    .bind(id)
    .first<ConnectionRow>();
  return row ? mapConnection(row) : null;
}

export async function getCustomerServiceConnection(
  db: D1Database,
  id: string,
): Promise<CustomerServiceConnectionRecord | null> {
  const connection = await getCustomerServiceConnectionInternal(db, id);
  return connection ? toPublicCustomerServiceConnection(connection) : null;
}

export function createCustomerServiceConnection(
  db: D1Database,
  input: CustomerServiceConnectionInput,
  now: string,
): { connection: CustomerServiceConnectionRecord; statement: D1PreparedStatement } {
  const id = crypto.randomUUID();
  const internal: CustomerServiceConnectionInternal = {
    id,
    name: input.name,
    provider: input.provider,
    baseUrl: input.baseUrl,
    verifyToken: input.verifyToken ?? null,
    hasVerifyToken: Boolean(input.verifyToken),
    clientApiUrl: null,
    realtimeUrl: null,
    verifiedAt: null,
    isEnabled: input.isEnabled,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    targetCount: 0,
  };
  return {
    connection: toPublicCustomerServiceConnection(internal),
    statement: db
      .prepare(
        `INSERT INTO customer_service_connections (
           id, name, provider, base_url, project_id, api_token,
           client_api_url, realtime_url, verified_at,
           is_enabled, created_at, updated_at, deleted_at
         ) VALUES (?, ?, ?, ?, NULL, ?, NULL, NULL, NULL, ?, ?, ?, NULL)`,
      )
      .bind(
        internal.id,
        internal.name,
        internal.provider,
        internal.baseUrl,
        internal.verifyToken,
        internal.isEnabled ? 1 : 0,
        internal.createdAt,
        internal.updatedAt,
      ),
  };
}

export function createUpdateCustomerServiceConnectionStatement(
  db: D1Database,
  id: string,
  input: CustomerServiceConnectionInput,
  currentVerifyToken: string | null,
  clearVerification: boolean,
  now: string,
): D1PreparedStatement {
  const verifyToken =
    input.verifyToken === undefined ? currentVerifyToken : input.verifyToken;
  return db
    .prepare(
      `UPDATE customer_service_connections
       SET name = ?, provider = ?, base_url = ?, project_id = NULL, api_token = ?,
           client_api_url = CASE WHEN ? THEN NULL ELSE client_api_url END,
           realtime_url = CASE WHEN ? THEN NULL ELSE realtime_url END,
           verified_at = CASE WHEN ? THEN NULL ELSE verified_at END,
           is_enabled = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(
      input.name,
      input.provider,
      input.baseUrl,
      verifyToken,
      clearVerification ? 1 : 0,
      clearVerification ? 1 : 0,
      clearVerification ? 1 : 0,
      input.isEnabled ? 1 : 0,
      now,
      id,
    );
}

export function createSetCustomerServiceVerificationStatement(
  db: D1Database,
  id: string,
  clientApiUrl: string,
  realtimeUrl: string,
  verifiedAt: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE customer_service_connections
       SET client_api_url = ?, realtime_url = ?, verified_at = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(clientApiUrl, realtimeUrl, verifiedAt, verifiedAt, id);
}

export function createDeleteCustomerServiceConnectionStatement(
  db: D1Database,
  id: string,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE customer_service_connections
       SET is_enabled = 0, deleted_at = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(now, now, id);
}

export function createRestoreCustomerServiceConnectionStatement(
  db: D1Database,
  id: string,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE customer_service_connections
       SET deleted_at = NULL, updated_at = ?
       WHERE id = ? AND deleted_at IS NOT NULL`,
    )
    .bind(now, id);
}

export function isCustomerServiceConnectionConflict(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('customer_service_connections_active_name_unique') ||
      error.message.includes(
        'UNIQUE constraint failed: customer_service_connections.name',
      ))
  );
}
