const IMAGE_EXTENSION_PATTERN = /\.(?:avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|webp)$/i;
const GUARD_BATCH_SIZE = 100;

export type AssetReferenceCounts = {
  logo: number;
  hero: number;
  sectionIcon: number;
  productCover: number;
  productGallery: number;
};

export type AssetCleanupBlockedReason =
  | 'IN_USE'
  | 'NOT_IMAGE'
  | 'SNAPSHOT_RETENTION'
  | null;

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
  cleanupBlockedReason: AssetCleanupBlockedReason;
  publicUrl: string | null;
};

export type MediaAssetReferenceRow = {
  id: string;
  object_key: string;
  status: string;
  deleted_at: string | null;
  updated_at: string;
  logo_count: number;
  hero_count: number;
  section_icon_count: number;
  product_cover_count: number;
  product_gallery_count: number;
};

type AssetCleanupGuardRow = {
  object_key: string;
  media_asset_id: string;
  guard_content_version: string;
  first_seen_at: string;
};

type RetainedVersionRow = {
  content_version: string;
};

type ModularMediaRow = {
  media_keys_json: string;
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

type SnapshotProtection = {
  modular: boolean;
  protectedKeys: Set<string>;
  retainedLegacyVersions: string[];
};

function buildPlaceholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function runStatementChunks(
  db: D1Database,
  statements: D1PreparedStatement[],
): Promise<void> {
  for (const batch of chunk(statements, GUARD_BATCH_SIZE)) {
    if (batch.length > 0) await db.batch(batch);
  }
}

function toReferenceCounts(row: MediaAssetReferenceRow | null): AssetReferenceCounts {
  return {
    logo: row?.logo_count ?? 0,
    hero: row?.hero_count ?? 0,
    sectionIcon: row?.section_icon_count ?? 0,
    productCover: row?.product_cover_count ?? 0,
    productGallery: row?.product_gallery_count ?? 0,
  };
}

export function countReferences(references: AssetReferenceCounts): number {
  return (
    references.logo +
    references.hero +
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

async function listRetainedPublishVersions(db: D1Database): Promise<string[]> {
  const rows = (
    await db
      .prepare(
        `SELECT content_version
         FROM publish_versions
         ORDER BY is_current DESC, published_at DESC, content_version DESC
         LIMIT 3`,
      )
      .all<RetainedVersionRow>()
  ).results;
  return rows.map((row) => row.content_version);
}

function parseMediaKeys(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((key): key is string => typeof key === 'string' && key.length > 0)
      : [];
  } catch {
    return [];
  }
}

async function getSnapshotProtection(db: D1Database): Promise<SnapshotProtection> {
  try {
    const rows = (
      await db
        .prepare(
          `SELECT v.media_keys_json
           FROM publish_module_versions v
           JOIN publish_module_jobs j ON j.id = v.publish_job_id
           WHERE j.status = 'published'`,
        )
        .all<ModularMediaRow>()
    ).results;
    if (rows.length > 0) {
      return {
        modular: true,
        protectedKeys: new Set(rows.flatMap((row) => parseMediaKeys(row.media_keys_json))),
        retainedLegacyVersions: [],
      };
    }
  } catch {
    // During local test mocks or a pre-migration rollout, fall back to legacy guards.
  }

  return {
    modular: false,
    protectedKeys: new Set(),
    retainedLegacyVersions: await listRetainedPublishVersions(db),
  };
}

async function getCleanupGuardRows(
  db: D1Database,
  keys: string[],
): Promise<Map<string, AssetCleanupGuardRow>> {
  if (keys.length === 0) return new Map();
  const result = await db
    .prepare(
      `SELECT object_key, media_asset_id, guard_content_version, first_seen_at
       FROM asset_cleanup_guards
       WHERE object_key IN (${buildPlaceholders(keys.length)})`,
    )
    .bind(...keys)
    .all<AssetCleanupGuardRow>();
  return new Map(result.results.map((row) => [row.object_key, row]));
}

async function synchronizeCleanupGuards(
  db: D1Database,
  rows: Map<string, MediaAssetReferenceRow>,
  retainedVersions: string[],
  now: string,
): Promise<Map<string, AssetCleanupGuardRow>> {
  const keys = [...rows.keys()];
  const guards = await getCleanupGuardRows(db, keys);
  const guardVersion = retainedVersions[0] ?? null;
  const statements: D1PreparedStatement[] = [];

  for (const row of rows.values()) {
    const referenceCount = countReferences(toReferenceCounts(row));
    const existing = guards.get(row.object_key);

    if (referenceCount > 0 || !guardVersion) {
      if (existing) {
        statements.push(
          db.prepare('DELETE FROM asset_cleanup_guards WHERE object_key = ?').bind(row.object_key),
        );
        guards.delete(row.object_key);
      }
      continue;
    }

    if (!existing) {
      const guard: AssetCleanupGuardRow = {
        object_key: row.object_key,
        media_asset_id: row.id,
        guard_content_version: guardVersion,
        first_seen_at: now,
      };
      statements.push(
        db
          .prepare(
            `INSERT INTO asset_cleanup_guards (
               object_key, media_asset_id, guard_content_version, first_seen_at
             ) VALUES (?, ?, ?, ?)
             ON CONFLICT(object_key) DO NOTHING`,
          )
          .bind(row.object_key, row.id, guardVersion, now),
      );
      guards.set(row.object_key, guard);
    }
  }

  await runStatementChunks(db, statements);
  return guards;
}

function legacyRetentionBlocked(
  row: MediaAssetReferenceRow | null,
  guard: AssetCleanupGuardRow | null,
  retainedVersions: Set<string>,
): boolean {
  return Boolean(
    row &&
      guard &&
      retainedVersions.has(guard.guard_content_version) &&
      countReferences(toReferenceCounts(row)) === 0,
  );
}

function modularRetentionBlocked(
  row: MediaAssetReferenceRow | null,
  key: string,
  protectedKeys: Set<string>,
): boolean {
  return Boolean(
    row &&
      countReferences(toReferenceCounts(row)) === 0 &&
      protectedKeys.has(key),
  );
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
         (SELECT COUNT(*) FROM site_hero_slides hs WHERE hs.media_asset_id = ma.id) AS hero_count,
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
  snapshotProtected: boolean,
  mediaBaseUrl: string | null,
): AdminAsset {
  const contentType = object.httpMetadata?.contentType ?? inferContentType(object.key);
  const references = toReferenceCounts(row);
  const referenceCount = countReferences(references);
  const cleanupBlockedReason: AssetCleanupBlockedReason =
    referenceCount > 0 ? 'IN_USE' : snapshotProtected ? 'SNAPSHOT_RETENTION' : null;

  return {
    key: object.key,
    size: object.size,
    uploadedAt: object.uploaded.toISOString(),
    etag: object.etag,
    contentType,
    usageStatus: referenceCount > 0 ? 'used' : 'unused',
    referenceCount,
    references,
    cleanupEligible: cleanupBlockedReason === null,
    cleanupBlockedReason,
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

  const [listed, mediaBaseUrl, protection] = await Promise.all([
    bucket.list(options),
    getMediaBaseUrl(db),
    getSnapshotProtection(db),
  ]);
  const imageObjects = listed.objects.filter((object) =>
    isImageObject(object.key, object.httpMetadata?.contentType ?? inferContentType(object.key)),
  );
  const rows = await getMediaAssetReferenceRows(
    db,
    imageObjects.map((object) => object.key),
  );

  let guards = new Map<string, AssetCleanupGuardRow>();
  let legacyRetainedSet = new Set<string>();
  if (!protection.modular) {
    guards = await synchronizeCleanupGuards(
      db,
      rows,
      protection.retainedLegacyVersions,
      new Date().toISOString(),
    );
    legacyRetainedSet = new Set(protection.retainedLegacyVersions);
  }

  return {
    assets: imageObjects.map((object) => {
      const row = rows.get(object.key) ?? null;
      const snapshotProtected = protection.modular
        ? modularRetentionBlocked(row, object.key, protection.protectedKeys)
        : legacyRetentionBlocked(row, guards.get(object.key) ?? null, legacyRetainedSet);
      return toAdminAsset(object, row, snapshotProtected, mediaBaseUrl);
    }),
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
  const [objects, rows, protection] = await Promise.all([
    Promise.all(keys.map((key) => bucket.head(key))),
    getMediaAssetReferenceRows(db, keys),
    getSnapshotProtection(db),
  ]);

  let guards = new Map<string, AssetCleanupGuardRow>();
  let legacyRetainedSet = new Set<string>();
  if (!protection.modular) {
    guards = await synchronizeCleanupGuards(
      db,
      rows,
      protection.retainedLegacyVersions,
      new Date().toISOString(),
    );
    legacyRetainedSet = new Set(protection.retainedLegacyVersions);
  }

  return keys.map((key, index) => {
    const object = objects[index] ?? null;
    const row = rows.get(key) ?? null;
    const referenceCount = countReferences(toReferenceCounts(row));
    const contentType = object?.httpMetadata?.contentType ?? inferContentType(key);
    const isImage = isImageObject(key, contentType);
    const snapshotProtected = protection.modular
      ? modularRetentionBlocked(row, key, protection.protectedKeys)
      : legacyRetentionBlocked(row, guards.get(key) ?? null, legacyRetainedSet);

    let blockedReason: AssetCleanupBlockedReason = null;
    if (referenceCount > 0) {
      blockedReason = 'IN_USE';
    } else if (!isImage) {
      blockedReason = 'NOT_IMAGE';
    } else if (snapshotProtected) {
      blockedReason = 'SNAPSHOT_RETENTION';
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
         AND NOT EXISTS (SELECT 1 FROM site_hero_slides hs WHERE hs.media_asset_id = media_assets.id)
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
