const FALLBACK_PREFIX = '/_media/';
const MAX_OBJECT_KEY_LENGTH = 1200;

export function sameOriginMediaFallbackUrl(
  source: string,
  pageOrigin: string,
): string | null {
  let sourceUrl: URL;
  let pageUrl: URL;
  try {
    sourceUrl = new URL(source, pageOrigin);
    pageUrl = new URL(pageOrigin);
  } catch {
    return null;
  }

  if (
    (sourceUrl.protocol !== 'https:' && sourceUrl.protocol !== 'http:') ||
    sourceUrl.origin === pageUrl.origin ||
    sourceUrl.username ||
    sourceUrl.password ||
    sourceUrl.pathname.startsWith(FALLBACK_PREFIX)
  ) {
    return null;
  }

  let objectKey: string;
  try {
    objectKey = decodeURIComponent(sourceUrl.pathname).replace(/^\/+/, '');
  } catch {
    return null;
  }
  if (!objectKey || objectKey.length > MAX_OBJECT_KEY_LENGTH) return null;

  const segments = objectKey.split('/');
  if (
    segments.length < 2 ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return null;
  }

  return `${pageUrl.origin}${FALLBACK_PREFIX}${segments.map(encodeURIComponent).join('/')}`;
}
