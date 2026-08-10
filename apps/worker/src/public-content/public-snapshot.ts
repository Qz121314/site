const PUBLIC_PREFIXES = ['public/versions/', 'public/modules/'] as const;
const SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/u;

export function publicSnapshotObjectKey(path: string | undefined): string | null {
  if (!path || path.length > 1200) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return null;
  }

  if (decoded.startsWith('/') || decoded.endsWith('/') || decoded.includes('\\'))
    return null;
  const segments = decoded.split('/');
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        !segment || segment === '.' || segment === '..' || !SEGMENT_PATTERN.test(segment),
    )
  ) {
    return null;
  }

  const key = `public/${segments.join('/')}`;
  if (!key.endsWith('.json')) return null;
  if (key === 'public/current.json') return key;
  return PUBLIC_PREFIXES.some((prefix) => key.startsWith(prefix)) ? key : null;
}

export function publicSnapshotCacheControl(
  objectKey: string,
  storedValue?: string,
): string {
  if (objectKey === 'public/current.json') {
    return 'public, max-age=30, must-revalidate';
  }
  return storedValue?.trim() || 'public, max-age=31536000, immutable';
}
