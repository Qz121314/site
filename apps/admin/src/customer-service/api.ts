import { AdminApiError } from '../api';

export type CustomerServiceScope = 'active' | 'trash' | 'all';
export type CustomerServiceProvider = 'generic_v1';

export type CustomerServiceConnection = {
  id: string;
  name: string;
  provider: CustomerServiceProvider;
  baseUrl: string;
  projectId: string | null;
  hasApiToken: boolean;
  privateConfig: string | null;
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
  projectId: string | null;
  apiToken?: string | null;
  privateConfig: string | null;
  isEnabled: boolean;
};

export type RemoteCustomerServiceGroup = {
  id: string;
  name: string;
  isEnabled: boolean;
};

type ErrorEnvelope = {
  error?: { code?: string; message?: string };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('application/json') ? response.json() : null;
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  const body = await readJson(response);
  if (!response.ok) {
    const envelope = asRecord(body) as ErrorEnvelope | null;
    throw new AdminApiError(
      response.status,
      envelope?.error?.code ?? 'CUSTOMER_SERVICE_REQUEST_FAILED',
      envelope?.error?.message ?? '客服系统请求失败。',
    );
  }
  return body;
}

function writeRequest(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) {
  return requestJson(path, {
    method,
    headers: {
      'x-admin-request': '1',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function parseConnection(value: unknown): CustomerServiceConnection {
  const connection = asRecord(value);
  if (
    !connection ||
    typeof connection.id !== 'string' ||
    typeof connection.name !== 'string' ||
    connection.provider !== 'generic_v1' ||
    typeof connection.baseUrl !== 'string' ||
    (typeof connection.projectId !== 'string' && connection.projectId !== null) ||
    typeof connection.hasApiToken !== 'boolean' ||
    (typeof connection.privateConfig !== 'string' && connection.privateConfig !== null) ||
    typeof connection.isEnabled !== 'boolean' ||
    typeof connection.createdAt !== 'string' ||
    typeof connection.updatedAt !== 'string' ||
    (typeof connection.deletedAt !== 'string' && connection.deletedAt !== null) ||
    typeof connection.targetCount !== 'number'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '客服系统连接返回数据无效。');
  }
  return connection as CustomerServiceConnection;
}

function parseConnectionEnvelope(value: unknown): CustomerServiceConnection {
  return parseConnection(asRecord(value)?.connection);
}

function parseConnectionList(value: unknown): CustomerServiceConnection[] {
  const connections = asRecord(value)?.connections;
  if (!Array.isArray(connections)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '客服系统列表返回数据无效。');
  }
  return connections.map(parseConnection);
}

function parseRemoteGroup(value: unknown): RemoteCustomerServiceGroup {
  const group = asRecord(value);
  if (
    !group ||
    typeof group.id !== 'string' ||
    typeof group.name !== 'string' ||
    typeof group.isEnabled !== 'boolean'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '客服分组返回数据无效。');
  }
  return group as RemoteCustomerServiceGroup;
}

const basePath = '/api/admin/customer-service/connections';

export function fetchCustomerServiceConnections(
  scope: CustomerServiceScope = 'active',
): Promise<CustomerServiceConnection[]> {
  return requestJson(`${basePath}?scope=${encodeURIComponent(scope)}`).then(parseConnectionList);
}

export function createCustomerServiceConnection(
  input: CustomerServiceConnectionInput,
): Promise<CustomerServiceConnection> {
  return writeRequest(basePath, 'POST', input).then(parseConnectionEnvelope);
}

export function updateCustomerServiceConnection(
  id: string,
  input: CustomerServiceConnectionInput,
): Promise<CustomerServiceConnection> {
  return writeRequest(`${basePath}/${encodeURIComponent(id)}`, 'PUT', input).then(
    parseConnectionEnvelope,
  );
}

export function deleteCustomerServiceConnection(id: string): Promise<CustomerServiceConnection> {
  return writeRequest(`${basePath}/${encodeURIComponent(id)}`, 'DELETE').then(parseConnectionEnvelope);
}

export function restoreCustomerServiceConnection(id: string): Promise<CustomerServiceConnection> {
  return writeRequest(`${basePath}/${encodeURIComponent(id)}/restore`, 'POST').then(
    parseConnectionEnvelope,
  );
}

export async function batchDeleteCustomerServiceConnections(ids: string[]): Promise<string[]> {
  const value = await requestJson(`${basePath}/batch-delete`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
      'x-idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({ ids }),
  });
  const result = asRecord(value);
  if (!result || !Array.isArray(result.deletedIds) || !result.deletedIds.every((id) => typeof id === 'string')) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '客服系统批量删除返回数据无效。');
  }
  return result.deletedIds;
}

export async function testCustomerServiceConnection(
  id: string,
): Promise<{ connected: true; groupCount: number }> {
  const value = asRecord(await writeRequest(`${basePath}/${encodeURIComponent(id)}/test`, 'POST'));
  if (!value || value.connected !== true || typeof value.groupCount !== 'number') {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '客服系统连接测试返回数据无效。');
  }
  return { connected: true, groupCount: value.groupCount };
}

export async function fetchRemoteCustomerServiceGroups(
  id: string,
): Promise<RemoteCustomerServiceGroup[]> {
  const value = asRecord(await requestJson(`${basePath}/${encodeURIComponent(id)}/groups`));
  if (!value || !Array.isArray(value.groups)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '客服分组列表返回数据无效。');
  }
  return value.groups.map(parseRemoteGroup);
}
