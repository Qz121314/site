const MAX_OBJECT_KEY_LENGTH = 1200;
const OBJECT_KEY_SEGMENT = /^[A-Za-z0-9._-]+$/u;

export function publicMediaFallbackObjectKey(path: string | undefined): string | null {
  if (!path || path.length > MAX_OBJECT_KEY_LENGTH) return null;

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
    segments.length < 2 ||
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        !OBJECT_KEY_SEGMENT.test(segment),
    )
  ) {
    return null;
  }

  return segments.join('/');
}

export async function isPublicMediaAsset(
  db: D1Database,
  objectKey: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT id
       FROM media_assets
       WHERE object_key = ?
         AND status = 'ready'
         AND deleted_at IS NULL
       LIMIT 1`,
    )
    .bind(objectKey)
    .first<{ id: string }>();
  return Boolean(row?.id);
}
