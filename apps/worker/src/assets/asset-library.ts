const IMAGE_EXTENSION_PATTERN = /\.(?:avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|webp)$/i;

export type AssetReferenceCounts = {
  logo: number;
  sectionIcon: number;
  productCover: number;
  productGallery: number;
};

export type AssetCleanupBlockedReason = 'IN_USE' | 'NOT_IMAGE' | null;

export type AdminAsset = {
  key: string;
  size: number;
  uploadedAt: string;
  etag: string;
  contentType: string | null;
  usageStatus: 'used' | 'unused';
  referenceCount: number;
  references: AssetReferenceCounts;
  cleanupEligible: boolean;
  publicUrl: string | null;
};

export type MediaAssetReferenceRow = {
  id: string;
  object_key: string;
  status: string;
  deleted_at: string | null;
  updated_at: string;
  logo_count: number;
  section_icon_count: number;
  product_cover_count: number;
  product_gallery_count: number;
};

export type AssetScanPage = {
  assets: AdminAsset[];
  cursor: string | null;
  truncated: boolean;
  mediaBaseUrl: string | null;
};

export type CleanupEvaluation = {
  key: string;
  object: R2Object | null;
  row: MediaAssetReferenceRow | null;
  referenceCount: number;
  blockedReason: AssetCleanupBlockedReason;
};

function buildPlaceholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

function toReferenceCounts(row: MediaAssetReferenceRow | null): AssetReferenceCounts {
  return {
    logo: row?.logo_count ?? 0,
    sectionIcon: row?.section_icon_count ?? 0,
    productCover: row?.product_cover_count ?? 0,
    productGallery: row?.product_gallery_count ?? 0,
  };
}

export function countReferences(references: AssetReferenceCounts): number {
  return (
    references.logo +
    references.sectionIcon +
    references.productCover +
    references.productGallery
  );
}

export function isValidR2ObjectKey(key: string): boolean {
  return key.length > 0 && key.length <= 1024 && !key.includes('\0');
}

function inferContentType(key: string): string | null {
  const extension = key.toLowerCase().split('.').pop();
  switch (extension) {
    case 'avif':
      return 'image/avif';
    case 'bmp':
      return 'image/bmp';
    case 'gif':
      return 'image/gif';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'ico':
      return 'image/x-icon';
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'svg':
      return 'image/svg+xml';
    case 'webp':
      return 'image/webp';
    default:
      return null;
  }
}

export function isImageObject(key: string, contentType: string | null): boolean {
  return contentType?.toLowerCase().startsWith('image/') === true || IMAGE_EXTENSION_PATTERN.test(key);
}

function encodeObjectKey(key: string): string {
  return key.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

export function buildAssetPublicUrl(mediaBaseUrl: string | null, key: string): string | null {
  return mediaBaseUrl ? `${mediaBaseUrl}/${encodeObjectKey(key)}` : null;
}

export async function getMediaBaseUrl(db: D1Database): Promise<string | null> {
  const row = await db
    .prepare('SELECT media_base_url FROM site_settings WHERE id = 1')
    .first<{ media_base_url: string | null }>();

  return row?.media_base_url ?? null;
}

export async function getMediaAssetReferenceRows(
  db: D1Database,
  keys: string[],
): Promise<Map<string, MediaAssetReferenceRow>> {
  if (keys.length === 0) {
    return new Map();
  }

  const result = await db
    .prepare(
      `SELECT
         ma.id,
         ma.object_key,
         ma.status,
         ma.deleted_at,
         ma.updated_at,
         (SELECT COUNT(*) FROM site_settings ss WHERE ss.logo_asset_id = ma.id) AS logo_count,
         (SELECT COUNT(*) FROM sections s WHERE s.icon_asset_id = ma.id) AS section_icon_count,
         (SELECT COUNT(*) FROM products p WHERE p.cover_asset_id = ma.id) AS product_cover_count,
         (SELECT COUNT(*) FROM product_media pm WHERE pm.media_asset_id = ma.id)
           AS product_gallery_count
       FROM media_assets ma
       WHERE ma.object_key IN (${buildPlaceholders(keys.length)})`,
    )
    .bind(...keys)
    .all<MediaAssetReferenceRow>();

  return new Map(result.results.map((row) => [row.object_key, row]));
}

function toAdminAsset(
  object: R2Object,
  row: MediaAssetReferenceRow | null,
  mediaBaseUrl: string | null,
): AdminAsset {
  const contentType = object.httpMetadata?.contentType ?? inferContentType(object.key);
  const references = toReferenceCounts(row);
  const referenceCount = countReferences(references);

  return {
    key: object.key,
    size: object.size,
    uploadedAt: object.uploaded.toISOString(),
    etag: object.etag,
    contentType,
    usageStatus: referenceCount > 0 ? 'used' : 'unused',
    referenceCount,
    references,
    cleanupEligible: referenceCount === 0,
    publicUrl: buildAssetPublicUrl(mediaBaseUrl, object.key),
  };
}

export async function scanAssetPage(
  bucket: R2Bucket,
  db: D1Database,
  input: { cursor?: string; limit: number },
): Promise<AssetScanPage> {
  const options: R2ListOptions = {
    limit: input.limit,
    include: ['httpMetadata'],
  };
  if (input.cursor) {
    options.cursor = input.cursor;
  }

  const [listed, mediaBaseUrl] = await Promise.all([bucket.list(options), getMediaBaseUrl(db)]);
  const imageObjects = listed.objects.filter((object) =>
    isImageObject(object.key, object.httpMetadata?.contentType ?? inferContentType(object.key)),
  );
  const rows = await getMediaAssetReferenceRows(
    db,
    imageObjects.map((object) => object.key),
  );

  return {
    assets: imageObjects.map((object) =>
      toAdminAsset(object, rows.get(object.key) ?? null, mediaBaseUrl),
    ),
    cursor: listed.truncated ? (listed.cursor ?? null) : null,
    truncated: listed.truncated,
    mediaBaseUrl,
  };
}

export async function evaluateCleanupCandidates(
  bucket: R2Bucket,
  db: D1Database,
  keys: string[],
): Promise<CleanupEvaluation[]> {
  const [objects, rows] = await Promise.all([
    Promise.all(keys.map((key) => bucket.head(key))),
    getMediaAssetReferenceRows(db, keys),
  ]);

  return keys.map((key, index) => {
    const object = objects[index] ?? null;
    const row = rows.get(key) ?? null;
    const referenceCount = countReferences(toReferenceCounts(row));
    const contentType = object?.httpMetadata?.contentType ?? inferContentType(key);
    const isImage = isImageObject(key, contentType);

    let blockedReason: AssetCleanupBlockedReason = null;
    if (referenceCount > 0) {
      blockedReason = 'IN_USE';
    } else if (!isImage) {
      blockedReason = 'NOT_IMAGE';
    }

    return { key, object, row, referenceCount, blockedReason };
  });
}

export function createMarkMediaAssetDeletedStatement(
  db: D1Database,
  row: MediaAssetReferenceRow,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE media_assets
       SET status = 'deleted', deleted_at = ?, updated_at = ?
       WHERE id = ?
         AND updated_at = ?
         AND NOT EXISTS (SELECT 1 FROM site_settings ss WHERE ss.logo_asset_id = media_assets.id)
         AND NOT EXISTS (SELECT 1 FROM sections s WHERE s.icon_asset_id = media_assets.id)
         AND NOT EXISTS (SELECT 1 FROM products p WHERE p.cover_asset_id = media_assets.id)
         AND NOT EXISTS (
           SELECT 1 FROM product_media pm WHERE pm.media_asset_id = media_assets.id
         )`,
    )
    .bind(now, now, row.id, row.updated_at);
}

export function createRestoreMediaAssetStatement(
  db: D1Database,
  row: MediaAssetReferenceRow,
  cleanupTimestamp: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE media_assets
       SET status = ?, deleted_at = ?, updated_at = ?
       WHERE id = ? AND status = 'deleted' AND updated_at = ?`,
    )
    .bind(row.status, row.deleted_at, row.updated_at, row.id, cleanupTimestamp);
}