import { AdminApiError } from '../api';

export type AdminFaq = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type FaqInput = {
  title: string;
  body: string;
};

type ErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
  };
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

function readError(value: unknown): ErrorEnvelope {
  return asRecord(value) ? (value as ErrorEnvelope) : {};
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  const body = await readJson(response);

  if (!response.ok) {
    const envelope = readError(body);
    throw new AdminApiError(
      response.status,
      envelope.error?.code ?? 'FAQ_REQUEST_FAILED',
      envelope.error?.message ?? 'FAQ 请求失败。',
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

function parseFaq(value: unknown): AdminFaq {
  const faq = asRecord(value);
  if (
    !faq ||
    typeof faq.id !== 'string' ||
    typeof faq.title !== 'string' ||
    typeof faq.body !== 'string' ||
    typeof faq.createdAt !== 'string' ||
    typeof faq.updatedAt !== 'string'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'FAQ 返回数据无效。');
  }

  return {
    id: faq.id,
    title: faq.title,
    body: faq.body,
    createdAt: faq.createdAt,
    updatedAt: faq.updatedAt,
  };
}

function parseFaqEnvelope(value: unknown): AdminFaq {
  const envelope = asRecord(value);
  return parseFaq(envelope?.faq);
}

function parseFaqList(value: unknown): AdminFaq[] {
  const envelope = asRecord(value);
  if (!envelope || !Array.isArray(envelope.faqs)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'FAQ 列表返回数据无效。');
  }
  return envelope.faqs.map(parseFaq);
}

export function fetchFaqs(): Promise<AdminFaq[]> {
  return requestJson('/api/admin/faqs/').then(parseFaqList);
}

export function createFaq(input: FaqInput): Promise<AdminFaq> {
  return writeRequest('/api/admin/faqs/', 'POST', input).then(parseFaqEnvelope);
}

export function updateFaq(id: string, input: FaqInput): Promise<AdminFaq> {
  return writeRequest(`/api/admin/faqs/${encodeURIComponent(id)}`, 'PUT', input).then(
    parseFaqEnvelope,
  );
}

export async function deleteFaq(id: string): Promise<string> {
  const body = await writeRequest(`/api/admin/faqs/${encodeURIComponent(id)}`, 'DELETE');
  const result = asRecord(body);
  if (!result || typeof result.deletedId !== 'string') {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'FAQ 删除返回数据无效。');
  }
  return result.deletedId;
}
