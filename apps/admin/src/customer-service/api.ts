import { AdminApiError, fetchSections } from '../api';
import { adminFetch } from '../admin-fetch';
import { fetchConversionGroups } from '../conversion-pool/api';
import { fetchProducts } from '../product-management/api';

export type CustomerServiceScope = 'active' | 'trash' | 'all';
export type CustomerServiceProvider = 'generic_v1';

export type CustomerServiceConnection = {
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

type ErrorEnvelope = {
  error?: { code?: string; message?: string };
};

type VerificationContext = {
  baseUrl: string;
  verifyToken: string;
};

type ProductCatalog = {
  products: Array<{
    id: string;
    title: string;
    href: null;
    coverUrl: string | null;
    sectionId: string;
    sectionName: string;
    categoryId: string | null;
    categoryName: string | null;
    isEnabled: true;
  }>;
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
  const response = await adminFetch(path, {
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
    typeof connection.hasVerifyToken !== 'boolean' ||
    (typeof connection.clientApiUrl !== 'string' && connection.clientApiUrl !== null) ||
    (typeof connection.realtimeUrl !== 'string' && connection.realtimeUrl !== null) ||
    (typeof connection.verifiedAt !== 'string' && connection.verifiedAt !== null) ||
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

function parseVerificationContext(value: unknown): VerificationContext {
  const context = asRecord(value);
  if (
    !context ||
    typeof context.baseUrl !== 'string' ||
    !context.baseUrl ||
    typeof context.verifyToken !== 'string' ||
    !context.verifyToken
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '客服系统验证上下文无效。');
  }
  return { baseUrl: context.baseUrl, verifyToken: context.verifyToken };
}

const basePath = '/api/admin/customer-service/connections';

export function fetchCustomerServiceConnections(
  scope: CustomerServiceScope = 'active',
): Promise<CustomerServiceConnection[]> {
  return requestJson(`${basePath}?scope=${encodeURIComponent(scope)}`).then(
    parseConnectionList,
  );
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

export function deleteCustomerServiceConnection(
  id: string,
): Promise<CustomerServiceConnection> {
  return writeRequest(`${basePath}/${encodeURIComponent(id)}`, 'DELETE').then(
    parseConnectionEnvelope,
  );
}

export function restoreCustomerServiceConnection(
  id: string,
): Promise<CustomerServiceConnection> {
  return writeRequest(`${basePath}/${encodeURIComponent(id)}/restore`, 'POST').then(
    parseConnectionEnvelope,
  );
}

export async function batchDeleteCustomerServiceConnections(
  ids: string[],
): Promise<string[]> {
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
  if (
    !result ||
    !Array.isArray(result.deletedIds) ||
    !result.deletedIds.every((id) => typeof id === 'string')
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '客服系统批量删除返回数据无效。');
  }
  return result.deletedIds;
}

async function loadProductCatalog(connectionId: string): Promise<ProductCatalog> {
  const sections = await fetchSections('active');
  const products = await Promise.all(
    sections.map(async (section) => {
      const [sectionProducts, conversionGroups] = await Promise.all([
        fetchProducts(section.id, 'active'),
        fetchConversionGroups(section.id, 'active'),
      ]);
      const groupById = new Map(conversionGroups.map((group) => [group.id, group]));

      return sectionProducts.flatMap((product) => {
        const group = product.conversionGroupId
          ? groupById.get(product.conversionGroupId)
          : undefined;
        if (
          product.status !== 'published' ||
          product.deletedAt ||
          product.conversionMode !== 'customer_service' ||
          !group ||
          group.deletedAt ||
          !group.isEnabled ||
          group.mode !== 'customer_service' ||
          group.customerServiceConnectionId !== connectionId
        ) {
          return [];
        }

        return [
          {
            id: product.id,
            title: product.title,
            href: null,
            coverUrl: product.effectiveCoverUrl,
            sectionId: section.id,
            sectionName: section.name,
            categoryId: product.categoryId,
            categoryName: product.categoryName,
            isEnabled: true as const,
          },
        ];
      });
    }),
  );

  return { products: products.flat() };
}

async function verifyPublicCustomerService(
  context: VerificationContext,
  productCatalog: ProductCatalog,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${context.baseUrl}/integration/v1/verify`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${context.verifyToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productCatalog }),
    });
  } catch {
    throw new AdminApiError(
      503,
      'CUSTOMER_SERVICE_UNREACHABLE',
      '浏览器无法连接客服系统验证接口，请确认公网地址可访问且客服系统已允许跨域验证。',
    );
  }

  const body = await readJson(response);
  if (!response.ok) {
    const message =
      response.status === 401
        ? '客服系统验证 Token 无效。'
        : response.status === 503
          ? '客服系统尚未启用接入验证。'
          : `客服系统验证接口返回 HTTP ${response.status}。`;
    throw new AdminApiError(
      response.status,
      response.status === 401
        ? 'CUSTOMER_SERVICE_VERIFY_TOKEN_INVALID'
        : 'CUSTOMER_SERVICE_UPSTREAM_ERROR',
      message,
    );
  }
  if (body === null) {
    throw new AdminApiError(
      502,
      'CUSTOMER_SERVICE_INVALID_RESPONSE',
      '客服系统验证接口未返回 JSON。',
    );
  }
  return body;
}

export async function testCustomerServiceConnection(
  id: string,
): Promise<{ connected: true; productCount: number; verifiedAt: string }> {
  const encodedId = encodeURIComponent(id);
  const [context, productCatalog] = await Promise.all([
    requestJson(`${basePath}/${encodedId}/verification-context`).then(
      parseVerificationContext,
    ),
    loadProductCatalog(id),
  ]);
  const integration = await verifyPublicCustomerService(context, productCatalog);
  const value = asRecord(
    await writeRequest(`${basePath}/${encodedId}/verification-result`, 'POST', {
      integration,
    }),
  );
  if (
    !value ||
    value.connected !== true ||
    typeof value.productCount !== 'number' ||
    typeof value.verifiedAt !== 'string'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '客服系统验证返回数据无效。');
  }
  return {
    connected: true,
    productCount: value.productCount,
    verifiedAt: value.verifiedAt,
  };
}
