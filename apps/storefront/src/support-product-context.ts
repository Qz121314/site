import type { SupportProductContextSnapshot } from './support-contract';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function parseSupportProductContext(
  value: unknown,
): SupportProductContextSnapshot | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.productId !== 'string' ||
    typeof value.title !== 'string' ||
    !nullableString(value.coverUrl) ||
    typeof value.href !== 'string' ||
    typeof value.sectionId !== 'string' ||
    !nullableString(value.sectionName) ||
    !nullableString(value.categoryId) ||
    !nullableString(value.categoryName)
  ) {
    return null;
  }
  return {
    productId: value.productId,
    title: value.title,
    coverUrl: value.coverUrl,
    href: value.href,
    sectionId: value.sectionId,
    sectionName: value.sectionName,
    categoryId: value.categoryId,
    categoryName: value.categoryName,
  };
}
