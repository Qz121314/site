import type { CustomerServiceConnectionInternal } from './customer-service-connections';

export type RemoteCustomerServiceGroup = {
  id: string;
  name: string;
  isEnabled: boolean;
};

export type VerifiedCustomerServiceIntegration = {
  protocolVersion: 'v1';
  clientApiUrl: string;
  realtimeUrl: string;
  groups: RemoteCustomerServiceGroup[];
};

export type CustomerServiceProviderTransport = {
  internalService?: Fetcher;
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

function shouldUseInternalService(
  connection: CustomerServiceConnectionInternal,
  transport?: CustomerServiceProviderTransport,
): boolean {
  if (!transport?.internalService) return false;
  const hostname = new URL(connection.baseUrl).hostname.toLowerCase();
  return hostname.startsWith('customer-service-app.') && hostname.endsWith('.workers.dev');
}

function safeHttpsUrl(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_RESPONSE',
      `客服系统未返回有效的${label}。`,
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_RESPONSE',
      `客服系统返回的${label}格式无效。`,
    );
  }
  if (url.protocol !== 'https:') {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_RESPONSE',
      `${label}必须使用 HTTPS。`,
    );
  }
  return url.toString().replace(/\/$/u, '');
}

function safeRealtimeUrl(value: unknown): string {
  if (typeof value !== 'string') {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_RESPONSE',
      '客服系统未返回有效的实时接口地址。',
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_RESPONSE',
      '客服系统返回的实时接口地址格式无效。',
    );
  }
  if (url.protocol !== 'wss:') {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_RESPONSE',
      '实时接口地址必须使用 WSS。',
    );
  }
  return url.toString();
}

function parseGroups(value: unknown): RemoteCustomerServiceGroup[] {
  if (!Array.isArray(value)) {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_GROUPS',
      '客服系统在线客服分组返回格式无效。',
    );
  }
  const groups: RemoteCustomerServiceGroup[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string') {
      throw new CustomerServiceProviderError(
        'CUSTOMER_SERVICE_INVALID_GROUPS',
        '客服系统在线客服分组返回格式无效。',
      );
    }
    const id = item.id.trim();
    const name = item.name.trim();
    if (!id || !name) continue;
    groups.push({ id, name, isEnabled: item.isEnabled !== false });
  }
  return groups;
}

function parseIntegration(value: unknown): VerifiedCustomerServiceIntegration {
  const envelope = isRecord(value) ? value : null;
  if (!envelope || envelope.ok !== true || envelope.protocolVersion !== 'v1') {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_RESPONSE',
      '客服系统验证接口返回格式无效。',
    );
  }
  return {
    protocolVersion: 'v1',
    clientApiUrl: safeHttpsUrl(envelope.clientApiUrl, '前端接口地址'),
    realtimeUrl: safeRealtimeUrl(envelope.realtimeUrl),
    groups: parseGroups(envelope.groups),
  };
}

/**
 * Control-plane transport only. Storefront never calls this adapter and never
 * receives the verification token. Same-account workers.dev can use a Service
 * Binding internally while the saved connection remains the public URL.
 */
export async function verifyCustomerServiceIntegration(
  connection: CustomerServiceConnectionInternal,
  transport?: CustomerServiceProviderTransport,
): Promise<VerifiedCustomerServiceIntegration> {
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
  if (!connection.verifyToken) {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_VERIFY_TOKEN_REQUIRED',
      '请先配置客服系统验证 Token。',
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const requestUrl = `${connection.baseUrl}/integration/v1/verify`;
    const requestInit: RequestInit = {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${connection.verifyToken}`,
      },
      signal: controller.signal,
      redirect: 'error',
    };
    const response = shouldUseInternalService(connection, transport)
      ? await transport!.internalService!.fetch(requestUrl, requestInit)
      : await fetch(requestUrl, requestInit);

    if (!response.ok) {
      const code =
        response.status === 401
          ? 'CUSTOMER_SERVICE_VERIFY_TOKEN_INVALID'
          : response.status === 503
            ? 'CUSTOMER_SERVICE_INTEGRATION_NOT_CONFIGURED'
            : 'CUSTOMER_SERVICE_UPSTREAM_ERROR';
      const message =
        response.status === 401
          ? '客服系统验证 Token 无效。'
          : response.status === 503
            ? '客服系统尚未启用接入验证。'
            : `客服系统验证接口返回 HTTP ${response.status}。`;
      throw new CustomerServiceProviderError(code, message);
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new CustomerServiceProviderError(
        'CUSTOMER_SERVICE_INVALID_RESPONSE',
        '客服系统验证接口未返回 JSON。',
      );
    }
    return parseIntegration((await response.json()) as unknown);
  } catch (error) {
    if (error instanceof CustomerServiceProviderError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new CustomerServiceProviderError(
        'CUSTOMER_SERVICE_TIMEOUT',
        '客服系统验证接口连接超时。',
      );
    }
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_UNREACHABLE',
      '无法连接客服系统验证接口。',
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function listRemoteCustomerServiceGroups(
  connection: CustomerServiceConnectionInternal,
  transport?: CustomerServiceProviderTransport,
): Promise<RemoteCustomerServiceGroup[]> {
  return (await verifyCustomerServiceIntegration(connection, transport)).groups;
}
