import { normalizeMediaBaseUrl } from '../settings/site-settings';

function normalizeObjectKey(objectKey: string): string {
  const trimmed = objectKey.trim();
  if (!trimmed || trimmed.startsWith('/') || trimmed.includes('\\')) {
    throw new Error('媒体对象 Key 无效。');
  }

  const segments = trimmed.split('/');
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        /[\u0000-\u001f\u007f]/.test(segment),
    )
  ) {
    throw new Error('媒体对象 Key 无效。');
  }

  return segments.map((segment) => encodeURIComponent(segment)).join('/');
}

export function buildMediaUrl(mediaBaseUrl: string, objectKey: string): string {
  const normalizedBaseUrl = normalizeMediaBaseUrl(mediaBaseUrl);
  if (!normalizedBaseUrl) {
    throw new Error('尚未配置 R2 自定义域名。');
  }

  return `${normalizedBaseUrl}/${normalizeObjectKey(objectKey)}`;
}
