export type VerifiedCustomerServiceIntegration = {
  protocolVersion: 'v1';
  clientApiUrl: string;
  realtimeUrl: string;
  productCount: number;
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

function parseProductCount(value: unknown): number {
  const catalog = isRecord(value) ? value : null;
  const productCount = catalog?.productCount;
  if (
    typeof productCount !== 'number' ||
    !Number.isInteger(productCount) ||
    productCount < 0
  ) {
    throw new CustomerServiceProviderError(
      'CUSTOMER_SERVICE_INVALID_PRODUCT_CATALOG',
      '客服系统产品目录同步结果无效。',
    );
  }
  return productCount;
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
    productCount: parseProductCount(envelope.productCatalog),
  };
}
