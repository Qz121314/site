import type { CustomerServiceConnectionInternal } from './customer-service-connections';

export type RemoteCustomerServiceGroup = {
  id: string;
  name: string;
  isEnabled: boolean;
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

function buildHeaders(
  connection: CustomerServiceConnectionInternal,
  extraHeaders?: HeadersInit,
): Headers {
  const headers = new Headers(extraHeaders);
  headers.set('Accept', 'application/json');
  if (connection.apiToken) headers.set('Authorization', `Bearer ${connection.apiToken}`);
  if (connection.projectId) headers.set('X-Project-Id', connection.projectId);
  return headers;
}

export async function customerServiceProviderFetchJson(
  connection: CustomerServiceConnectionInternal,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  if (connection.provider !== 'generic_v1') {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_PROVIDER_UNSUPPORTED',
      '当前客服系统类型尚未实现适配器。',
    );
  }
  if (!connection.isEnabled || connection.deletedAt) {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_CONNECTION_DISABLED',
      '该客服系统连接当前未启用。',
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${connection.baseUrl}${path}`, {
      ...init,
      headers: buildHeaders(connection, init?.headers),
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

function parseGroups(value: unknown): RemoteCustomerServiceGroup[] {
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

export async function listRemoteCustomerServiceGroups(
  connection: CustomerServiceConnectionInternal,
): Promise<RemoteCustomerServiceGroup[]> {
  return parseGroups(await customerServiceProviderFetchJson(connection, '/groups'));
}

export async function testCustomerServiceConnection(
  connection: CustomerServiceConnectionInternal,
): Promise<{ connected: true; groupCount: number }> {
  const groups = await listRemoteCustomerServiceGroups(connection);
  return { connected: true, groupCount: groups.length };
}
