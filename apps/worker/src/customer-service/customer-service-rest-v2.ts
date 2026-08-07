import type { CustomerServiceConnectionInternal } from './customer-service-connections';

export type RestV2AuthType = 'bearer' | 'basic' | 'api_key' | 'none';
export type RestV2EntryMethod = 'GET' | 'POST';
export type RestV2EntryMode = 'request' | 'template';

export type RestV2Config = {
  auth?: {
    type?: RestV2AuthType;
    headerName?: string;
    username?: string;
    prefix?: string;
  };
  projectHeaderName?: string;
  headers?: Record<string, string>;
  groups?: {
    path?: string;
    itemsPath?: string;
    idPath?: string;
    namePath?: string;
    enabledPath?: string;
  };
  entry?: {
    mode?: RestV2EntryMode;
    method?: RestV2EntryMethod;
    pathTemplate?: string;
    urlPath?: string;
    urlTemplate?: string;
  };
};

export type RestV2RemoteGroup = {
  id: string;
  name: string;
  isEnabled: boolean;
};

export class RestV2AdapterError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RestV2AdapterError';
    this.code = code;
  }
}

const AUTO = 'auto';
const GROUP_ARRAY_PATHS = [
  'groups',
  'items',
  'results',
  'data',
  'teams',
  'departments',
  'data.groups',
  'data.items',
  'data.results',
  'data.teams',
  'data.departments',
] as const;
const GROUP_ID_PATHS = [
  'id',
  '_id',
  'uuid',
  'groupId',
  'group_id',
  'teamId',
  'team_id',
  'departmentId',
  'department_id',
] as const;
const GROUP_NAME_PATHS = ['name', 'title', 'displayName', 'display_name', 'label'] as const;
const GROUP_ENABLED_PATHS = ['isEnabled', 'is_enabled', 'enabled', 'active', 'status'] as const;
const ENTRY_URL_PATHS = [
  'url',
  'entryUrl',
  'entry_url',
  'chatUrl',
  'chat_url',
  'link',
  'href',
  'data.url',
  'data.entryUrl',
  'data.entry_url',
] as const;
const FORBIDDEN_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'host',
  'connection',
  'content-length',
  'cf-connecting-ip',
  'cf-ray',
  'x-forwarded-for',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readConfig(connection: CustomerServiceConnectionInternal): RestV2Config {
  if (!connection.privateConfig) return {};
  try {
    const value = JSON.parse(connection.privateConfig) as unknown;
    if (!isRecord(value)) throw new Error('INVALID_CONFIG');
    return value as RestV2Config;
  } catch {
    throw new RestV2AdapterError(
      'CUSTOMER_SERVICE_CONFIG_INVALID',
      '客服系统高级配置无效。',
    );
  }
}

function normalizeRelativePath(value: string | undefined, fallback: string): string {
  const raw = value?.trim() || fallback;
  if (/^https?:\/\//iu.test(raw) || raw.startsWith('//')) {
    throw new RestV2AdapterError(
      'CUSTOMER_SERVICE_CONFIG_INVALID',
      '客服系统接口路径必须是相对路径。',
    );
  }
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/u, '')}${normalizeRelativePath(path, '/')}`;
}

function readPath(value: unknown, path: string): unknown {
  if (!path || path === AUTO) return value;
  let current = value;
  for (const segment of path.split('.')) {
    if (!isRecord(current) || !Object.hasOwn(current, segment)) return undefined;
    current = current[segment];
  }
  return current;
}

function readFirstPath(value: unknown, paths: readonly string[]): unknown {
  for (const path of paths) {
    const candidate = readPath(value, path);
    if (candidate !== undefined && candidate !== null) return candidate;
  }
  return undefined;
}

function normalizeScalar(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function normalizeEnabled(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return !['0', 'false', 'disabled', 'inactive', 'off', 'deleted', 'archived'].includes(normalized);
  }
  return true;
}

function readGroupItems(value: unknown, configuredPath: string | undefined): unknown[] {
  if (configuredPath && configuredPath !== AUTO) {
    const configured = readPath(value, configuredPath);
    if (Array.isArray(configured)) return configured;
    throw new RestV2AdapterError(
      'CUSTOMER_SERVICE_INVALID_GROUPS',
      '客服系统分组列表路径没有返回数组。',
    );
  }
  if (Array.isArray(value)) return value;
  for (const path of GROUP_ARRAY_PATHS) {
    const candidate = readPath(value, path);
    if (Array.isArray(candidate)) return candidate;
  }
  throw new RestV2AdapterError(
    'CUSTOMER_SERVICE_INVALID_GROUPS',
    '无法识别客服系统返回的分组列表。',
  );
}

function readGroupField(
  item: unknown,
  configuredPath: string | undefined,
  autoPaths: readonly string[],
): unknown {
  if (configuredPath && configuredPath !== AUTO) return readPath(item, configuredPath);
  return readFirstPath(item, autoPaths);
}

function buildHeaders(
  connection: CustomerServiceConnectionInternal,
  config: RestV2Config,
  extraHeaders?: HeadersInit,
): Headers {
  const headers = new Headers(extraHeaders);
  headers.set('Accept', 'application/json');

  if (config.headers && isRecord(config.headers)) {
    for (const [name, rawValue] of Object.entries(config.headers)) {
      const normalizedName = name.trim();
      if (!normalizedName || FORBIDDEN_HEADER_NAMES.has(normalizedName.toLowerCase())) continue;
      if (typeof rawValue === 'string' && rawValue.trim()) headers.set(normalizedName, rawValue.trim());
    }
  }

  if (connection.projectId && config.projectHeaderName?.trim()) {
    headers.set(config.projectHeaderName.trim(), connection.projectId);
  }

  const authType = config.auth?.type ?? 'bearer';
  const token = connection.apiToken?.trim() ?? '';
  if (authType === 'bearer' && token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else if (authType === 'basic' && token) {
    const username = config.auth?.username?.trim() ?? '';
    headers.set('Authorization', `Basic ${btoa(`${username}:${token}`)}`);
  } else if (authType === 'api_key' && token) {
    const headerName = config.auth?.headerName?.trim() || 'X-API-Key';
    if (FORBIDDEN_HEADER_NAMES.has(headerName.toLowerCase())) {
      throw new RestV2AdapterError(
        'CUSTOMER_SERVICE_CONFIG_INVALID',
        'API Key Header 名称无效。',
      );
    }
    headers.set(headerName, `${config.auth?.prefix ?? ''}${token}`);
  }

  return headers;
}

async function requestJson(
  connection: CustomerServiceConnectionInternal,
  config: RestV2Config,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(buildUrl(connection.baseUrl, path), {
      ...init,
      headers: buildHeaders(connection, config, init?.headers),
      signal: controller.signal,
      redirect: 'error',
    });
    if (!response.ok) {
      throw new RestV2AdapterError(
        'CUSTOMER_SERVICE_UPSTREAM_ERROR',
        `客服系统接口返回 HTTP ${response.status}。`,
      );
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('json')) {
      throw new RestV2AdapterError(
        'CUSTOMER_SERVICE_INVALID_RESPONSE',
        '客服系统接口未返回 JSON。',
      );
    }
    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof RestV2AdapterError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new RestV2AdapterError('CUSTOMER_SERVICE_TIMEOUT', '客服系统接口连接超时。');
    }
    throw new RestV2AdapterError('CUSTOMER_SERVICE_UNREACHABLE', '无法连接客服系统接口。');
  } finally {
    clearTimeout(timeout);
  }
}

export async function listRestV2Groups(
  connection: CustomerServiceConnectionInternal,
): Promise<RestV2RemoteGroup[]> {
  const config = readConfig(connection);
  const groupsConfig = config.groups ?? {};
  const value = await requestJson(
    connection,
    config,
    normalizeRelativePath(groupsConfig.path, '/groups'),
  );
  const items = readGroupItems(value, groupsConfig.itemsPath);
  const groups: RestV2RemoteGroup[] = [];
  for (const item of items) {
    const id = normalizeScalar(readGroupField(item, groupsConfig.idPath, GROUP_ID_PATHS));
    const name = normalizeScalar(readGroupField(item, groupsConfig.namePath, GROUP_NAME_PATHS));
    if (!id || !name) continue;
    const enabledValue = readGroupField(item, groupsConfig.enabledPath, GROUP_ENABLED_PATHS);
    groups.push({ id, name, isEnabled: normalizeEnabled(enabledValue) });
  }
  if (items.length > 0 && groups.length === 0) {
    throw new RestV2AdapterError(
      'CUSTOMER_SERVICE_INVALID_GROUPS',
      '已读取分组列表，但无法识别分组 ID 或名称字段。',
    );
  }
  return groups;
}

function replaceGroupId(template: string, remoteGroupId: string): string {
  return template.replaceAll('{groupId}', encodeURIComponent(remoteGroupId));
}

function validateEntryUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('INVALID_PROTOCOL');
    return url.toString();
  } catch {
    throw new RestV2AdapterError(
      'CUSTOMER_SERVICE_INVALID_ENTRY',
      '客服系统返回的会话入口地址无效。',
    );
  }
}

export async function resolveRestV2Entry(
  connection: CustomerServiceConnectionInternal,
  remoteGroupId: string,
  payload: { requestId: string; productId: string; sectionId: string },
): Promise<{ url: string }> {
  const config = readConfig(connection);
  const entry = config.entry ?? {};
  const mode = entry.mode ?? 'request';

  if (mode === 'template') {
    const template = entry.urlTemplate?.trim();
    if (!template) {
      throw new RestV2AdapterError(
        'CUSTOMER_SERVICE_CONFIG_INVALID',
        '客服系统没有配置会话入口 URL 模板。',
      );
    }
    return { url: validateEntryUrl(replaceGroupId(template, remoteGroupId)) };
  }

  const path = replaceGroupId(
    normalizeRelativePath(entry.pathTemplate, '/groups/{groupId}/entry'),
    remoteGroupId,
  );
  const method = entry.method ?? 'POST';
  const value = await requestJson(connection, config, path, {
    method,
    ...(method === 'POST'
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      : {}),
  });
  const configuredUrlPath = entry.urlPath?.trim();
  const rawUrl = configuredUrlPath && configuredUrlPath !== AUTO
    ? readPath(value, configuredUrlPath)
    : readFirstPath(value, ENTRY_URL_PATHS);
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new RestV2AdapterError(
      'CUSTOMER_SERVICE_INVALID_ENTRY',
      '客服系统没有返回可识别的会话入口 URL。',
    );
  }
  return { url: validateEntryUrl(rawUrl.trim()) };
}
