import { apiError } from '../http/api-response';
import type { SectionRecord } from '../sections/sections';

const ADMIN_REQUEST_HEADER = 'x-admin-request';

export function hasAdminRequestHeader(context: Parameters<typeof apiError>[0]): boolean {
  return context.req.header(ADMIN_REQUEST_HEADER) === '1';
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readJsonBody(context: Parameters<typeof apiError>[0]): Promise<unknown> {
  const contentType = context.req.header('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new Error('INVALID_CONTENT_TYPE');
  }

  try {
    return await context.req.json<unknown>();
  } catch {
    throw new Error('INVALID_JSON');
  }
}

export function jsonBodyError(context: Parameters<typeof apiError>[0], error: unknown) {
  const invalidContentType = error instanceof Error && error.message === 'INVALID_CONTENT_TYPE';
  return apiError(
    context,
    400,
    invalidContentType ? 'INVALID_CONTENT_TYPE' : 'INVALID_JSON',
    invalidContentType ? '请求必须使用 JSON。' : '请求 JSON 无效。',
  );
}

export function dependencyError(
  context: Parameters<typeof apiError>[0],
  section: SectionRecord,
) {
  return apiError(
    context,
    409,
    'SECTION_HAS_DEPENDENCIES',
    `分区“${section.name}”仍有关联产品或转化方式，不能删除。`,
    {
      productCount: section.productCount,
      conversionMethodCount: section.conversionMethodCount,
    },
  );
}
