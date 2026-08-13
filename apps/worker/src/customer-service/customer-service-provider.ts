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

/**
 * Validate the public generic-v1 integration response returned to the Site
 * admin browser. This module intentionally performs no network I/O: Site's
 * Worker never contacts a customer-service Worker directly.
 */
export function parseCustomerServiceIntegration(
  value: unknown,
): VerifiedCustomerServiceIntegration {
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
