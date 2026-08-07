import type { CustomerServiceConnectionInternal } from './customer-service-connections';
import {
  listRestV2Groups,
  resolveRestV2Entry,
  RestV2AdapterError,
} from './customer-service-rest-v2';

export type RemoteCustomerServiceGroup = {
  id: string;
  name: string;
  isEnabled: boolean;
};

export type ResolvedCustomerServiceEntry = {
  url: string;
};

export class CustomerServiceProviderError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CustomerServiceProviderError';
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildLegacyHeaders(
  connection: CustomerServiceConnectionInternal,
  extraHeaders?: HeadersInit,
): Headers {
  const headers = new Headers(extraHeaders);
  headers.set('Accept', 'application/json');
  if (connection.apiToken) headers.set('Authorization', `Bearer ${connection.apiToken}`);
  if (connection.projectId) headers.set('X-Project-Id', connection.projectId);
  return headers;
}

async function legacyProviderFetch(
  connection: CustomerServiceConnectionInternal,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${connection.baseUrl}${path}`, {
      ...init,
      headers: buildLegacyHeaders(connection, init?.headers),
      signal: controller.signal,
      redirect: 'error',
    });
    if (!response.ok) {
      throw new CustomerServiceProviderError(
        'CUSTOMER_SERVICE_UPSTREAM_ERROR',
        `客服系统接口返回 HTTP ${response.status}。`,
      );
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new CustomerServiceProviderError(
        'CUSTOMER_SERVICE_INVALID_RESPONSE',
        '客服系统接口未返回 JSON。',
      );
    }
    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof CustomerServiceProviderError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new CustomerServiceProviderError(
        'CUSTOMER_SERVICE_TIMEOUT',
        '客服系统接口连接超时。',
      );
    }
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_UNREACHABLE',
      '无法连接客服系统接口。',
    );
  } finally {
    clearTimeout(timeout);
  }
}

function parseLegacyGroups(value: unknown): RemoteCustomerServiceGroup[] {
  const envelope = isRecord(value) ? value : null;
  if (!envelope || !Array.isArray(envelope.groups)) {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_GROUPS',
      '客服系统分组接口返回格式无效。',
    );
  }
  const groups: RemoteCustomerServiceGroup[] = [];
  for (const item of envelope.groups) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string') {
      throw new CustomerServiceProviderError(
        'CUSTOMER_SERVICE_INVALID_GROUPS',
        '客服系统分组接口返回格式无效。',
      );
    }
    const id = item.id.trim();
    const name = item.name.trim();
    if (!id || !name) continue;
    groups.push({
      id,
      name,
      isEnabled: item.isEnabled !== false,
    });
  }
  return groups;
}

function providerError(error: unknown): CustomerServiceProviderError {
  if (error instanceof CustomerServiceProviderError) return error;
  if (error instanceof RestV2AdapterError) {
    return new CustomerServiceProviderError(error.code, error.message);
  }
  return new CustomerServiceProviderError(
    'CUSTOMER_SERVICE_UNKNOWN_ERROR',
    '客服系统接口发生未知错误。',
  );
}

function assertConnectionEnabled(connection: CustomerServiceConnectionInternal) {
  if (!connection.isEnabled || connection.deletedAt) {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_CONNECTION_DISABLED',
      '该客服系统连接当前未启用。',
    );
  }
}

export async function listRemoteCustomerServiceGroups(
  connection: CustomerServiceConnectionInternal,
): Promise<RemoteCustomerServiceGroup[]> {
  assertConnectionEnabled(connection);
  try {
    if (connection.provider === 'generic_rest_v2') {
      return await listRestV2Groups(connection);
    }
    return parseLegacyGroups(await legacyProviderFetch(connection, '/groups'));
  } catch (error) {
    throw providerError(error);
  }
}

export async function testCustomerServiceConnection(
  connection: CustomerServiceConnectionInternal,
): Promise<{ connected: true; groupCount: number }> {
  const groups = await listRemoteCustomerServiceGroups(connection);
  return { connected: true, groupCount: groups.length };
}

export async function resolveCustomerServiceGroupEntry(
  connection: CustomerServiceConnectionInternal,
  remoteGroupId: string,
  payload: { requestId: string; productId: string; sectionId: string },
): Promise<ResolvedCustomerServiceEntry> {
  assertConnectionEnabled(connection);
  if (connection.provider === 'generic_rest_v2') {
    try {
      return await resolveRestV2Entry(connection, remoteGroupId, payload);
    } catch (error) {
      throw providerError(error);
    }
  }

  const value = await legacyProviderFetch(
    connection,
    `/groups/${encodeURIComponent(remoteGroupId)}/entry`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  const envelope = isRecord(value) ? value : null;
  if (!envelope || typeof envelope.url !== 'string') {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_ENTRY',
      '客服系统没有返回有效的会话入口。',
    );
  }
  try {
    const url = new URL(envelope.url);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('INVALID_PROTOCOL');
    return { url: url.toString() };
  } catch {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_ENTRY',
      '客服系统返回的会话入口地址无效。',
    );
  }
}
