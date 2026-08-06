import { normalizeMediaBaseUrl } from '../settings/site-settings';

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const characterCode = value.charCodeAt(index);
    if (characterCode <= 31 || characterCode === 127) {
      return true;
    }
  }

  return false;
}

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
        containsControlCharacter(segment),
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
