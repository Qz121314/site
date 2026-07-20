import { env } from "cloudflare:workers";

export const ADMIN_IMAGE_PAGE_SIZE = 48;
export const UNUSED_IMAGE_CLEANUP_LIMIT = 100;
export const MAX_IMAGE_MUTATION_IDS = 100;

export const ADMIN_IMAGE_FILTERS = ["all", "used", "unused"] as const;
export type AdminImageFilter = (typeof ADMIN_IMAGE_FILTERS)[number];

export type AdminImageAsset = {
  id: string;
  objectKey: string;
  originalName: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  createdAt: string;
  logoReferences: number;
  faviconReferences: number;
  categoryReferences: number;
  productCoverReferences: number;
  productGalleryReferences: number;
  advertisementReferences: number;
  referenceCount: number;
};

export type AdminImageObject = {
  id: string;
  objectKey: string;
  mimeType: string;
};

export type AdminImagePage = {
  images: AdminImageAsset[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  databaseReady: boolean;
  r2PublicBaseUrl: string;
};

export type ImageDeleteResult = {
  found: AdminImageObject[];
  deleted: AdminImageObject[];
  remainingIds: string[];
};

type AdminImageRow = {
  id: string;
  object_key: string;
  original_name: string;
  mime_type: string;
  width: number;
  height: number;
  size_bytes: number;
  created_at: string;
  logo_references: number;
  favicon_references: number;
  category_references: number;
  product_cover_references: number;
  product_gallery_references: number;
  advertisement_references: number;
  reference_count: number;
  filtered_total?: number;
};

type ImageObjectRow = {
  id: string;
  object_key: string;
  mime_type: string;
};

type BaseUrlRow = { r2_public_base_url: string };

const usageCtes = `
  WITH
  site_usage AS (
    SELECT logo_asset_id, favicon_asset_id
    FROM site_settings
    WHERE id = 1
  ),
  category_usage AS (
    SELECT image_asset_id, COUNT(*) AS references_count
    FROM categories
    WHERE image_asset_id IS NOT NULL
    GROUP BY image_asset_id
  ),
  cover_usage AS (
    SELECT cover_asset_id AS image_asset_id, COUNT(*) AS references_count
    FROM products
    WHERE cover_asset_id IS NOT NULL
    GROUP BY cover_asset_id
  ),
  gallery_usage AS (
    SELECT image_asset_id, COUNT(*) AS references_count
    FROM product_images
    GROUP BY image_asset_id
  ),
  advertisement_usage AS (
    SELECT image_asset_id, COUNT(*) AS references_count
    FROM advertisements
    GROUP BY image_asset_id
  ),
  images_with_usage AS (
    SELECT
      a.id,
      a.object_key,
      a.original_name,
      a.mime_type,
      a.width,
      a.height,
      a.size_bytes,
      a.created_at,
      CASE WHEN s.logo_asset_id = a.id THEN 1 ELSE 0 END AS logo_references,
      CASE WHEN s.favicon_asset_id = a.id THEN 1 ELSE 0 END AS favicon_references,
      COALESCE(c.references_count, 0) AS category_references,
      COALESCE(pc.references_count, 0) AS product_cover_references,
      COALESCE(pg.references_count, 0) AS product_gallery_references,
      COALESCE(ad.references_count, 0) AS advertisement_references,
      CASE WHEN s.logo_asset_id = a.id THEN 1 ELSE 0 END +
      CASE WHEN s.favicon_asset_id = a.id THEN 1 ELSE 0 END +
      COALESCE(c.references_count, 0) +
      COALESCE(pc.references_count, 0) +
      COALESCE(pg.references_count, 0) +
      COALESCE(ad.references_count, 0) AS reference_count
    FROM image_assets a
    LEFT JOIN site_usage s ON 1 = 1
    LEFT JOIN category_usage c ON c.image_asset_id = a.id
    LEFT JOIN cover_usage pc ON pc.image_asset_id = a.id
    LEFT JOIN gallery_usage pg ON pg.image_asset_id = a.id
    LEFT JOIN advertisement_usage ad ON ad.image_asset_id = a.id
  )
`;

function normalizePage(value: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}

function normalizeFilter(value: string): AdminImageFilter {
  return ADMIN_IMAGE_FILTERS.includes(value as AdminImageFilter) ? (value as AdminImageFilter) : "all";
}

function truncateUtf8(value: string, maximumBytes: number): string {
  const encoder = new TextEncoder();
  let output = "";
  let bytes = 0;
  for (const character of value) {
    const length = encoder.encode(character).byteLength;
    if (bytes + length > maximumBytes) break;
    output += character;
    bytes += length;
  }
  return output;
}

function escapeLike(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

function mapImage(row: AdminImageRow): AdminImageAsset {
  return {
    id: row.id,
    objectKey: row.object_key,
    originalName: row.original_name,
    mimeType: row.mime_type,
    width: Number(row.width),
    height: Number(row.height),
    sizeBytes: Number(row.size_bytes),
    createdAt: row.created_at,
    logoReferences: Number(row.logo_references),
    faviconReferences: Number(row.favicon_references),
    categoryReferences: Number(row.category_references),
    productCoverReferences: Number(row.product_cover_references),
    productGalleryReferences: Number(row.product_gallery_references),
    advertisementReferences: Number(row.advertisement_references),
    referenceCount: Number(row.reference_count),
  };
}

function mapImageObject(row: ImageObjectRow): AdminImageObject {
  return { id: row.id, objectKey: row.object_key, mimeType: row.mime_type };
}

function buildWhere(query: string, filter: AdminImageFilter): { sql: string; bindings: string[] } {
  const clauses: string[] = [];
  const bindings: string[] = [];

  if (query) {
    const pattern = `%${escapeLike(query)}%`;
    clauses.push("(original_name LIKE ? ESCAPE '\\' OR object_key LIKE ? ESCAPE '\\')");
    bindings.push(pattern, pattern);
  }

  if (filter === "used") clauses.push("reference_count > 0");
  if (filter === "unused") clauses.push("reference_count = 0");
  return { sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "", bindings };
}

async function loadR2PublicBaseUrl(): Promise<string> {
  const row = await env.DB.prepare(
    "SELECT r2_public_base_url FROM site_settings WHERE id = 1",
  ).first<BaseUrlRow>();
  return row?.r2_public_base_url ?? "";
}

async function runImagePageQuery(
  where: { sql: string; bindings: string[] },
  offset: number,
): Promise<AdminImageRow[]> {
  const result = await env.DB.prepare(
    `${usageCtes},
     filtered_images AS (
       SELECT * FROM images_with_usage ${where.sql}
     )
     SELECT filtered_images.*, COUNT(*) OVER() AS filtered_total
     FROM filtered_images
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
  ).bind(...where.bindings, ADMIN_IMAGE_PAGE_SIZE, offset).all<AdminImageRow>();
  return result.results;
}

export async function loadAdminImagePage(input: {
  query?: string;
  filter?: string;
  page?: number;
}): Promise<AdminImagePage> {
  const query = truncateUtf8((input.query ?? "").trim(), 48);
  const filter = normalizeFilter(input.filter ?? "all");
  const requestedPage = normalizePage(input.page ?? 1);

  try {
    const where = buildWhere(query, filter);
    const baseUrlPromise = loadR2PublicBaseUrl();
    let page = requestedPage;
    let rows = await runImagePageQuery(where, (page - 1) * ADMIN_IMAGE_PAGE_SIZE);
    if (rows.length === 0 && page > 1) {
      page = 1;
      rows = await runImagePageQuery(where, 0);
    }

    const total = Number(rows[0]?.filtered_total ?? 0);
    return {
      images: rows.map(mapImage),
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / ADMIN_IMAGE_PAGE_SIZE)),
      pageSize: ADMIN_IMAGE_PAGE_SIZE,
      databaseReady: true,
      r2PublicBaseUrl: await baseUrlPromise,
    };
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_images_read_failed", error: String(error) }));
    return {
      images: [],
      total: 0,
      page: 1,
      pageCount: 1,
      pageSize: ADMIN_IMAGE_PAGE_SIZE,
      databaseReady: false,
      r2PublicBaseUrl: "",
    };
  }
}

export async function loadAdminImage(imageId: string): Promise<AdminImageAsset | null> {
  const row = await env.DB.prepare(
    `${usageCtes}
     SELECT * FROM images_with_usage WHERE id = ?1`,
  ).bind(imageId).first<AdminImageRow>();
  return row ? mapImage(row) : null;
}

export async function loadAdminImageObject(imageId: string): Promise<AdminImageObject | null> {
  const row = await env.DB.prepare(
    "SELECT id, object_key, mime_type FROM image_assets WHERE id = ?1",
  ).bind(imageId).first<ImageObjectRow>();
  return row ? mapImageObject(row) : null;
}

export async function loadAdminImages(imageIds: readonly string[]): Promise<AdminImageAsset[]> {
  const uniqueIds = [...new Set(imageIds.filter(Boolean))].slice(0, MAX_IMAGE_MUTATION_IDS);
  if (uniqueIds.length === 0) return [];
  const placeholders = uniqueIds.map((_, index) => `?${index + 1}`).join(", ");
  const result = await env.DB.prepare(
    `${usageCtes}
     SELECT * FROM images_with_usage WHERE id IN (${placeholders})`,
  ).bind(...uniqueIds).all<AdminImageRow>();
  return result.results.map(mapImage);
}

export async function loadUnusedImageObjectsForCleanup(): Promise<AdminImageObject[]> {
  const result = await env.DB.prepare(
    `SELECT a.id, a.object_key, a.mime_type
     FROM image_assets a
     WHERE a.created_at <= datetime('now', '-24 hours')
       AND NOT EXISTS (SELECT 1 FROM site_settings s WHERE s.logo_asset_id = a.id OR s.favicon_asset_id = a.id)
       AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.image_asset_id = a.id)
       AND NOT EXISTS (SELECT 1 FROM products p WHERE p.cover_asset_id = a.id)
       AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.image_asset_id = a.id)
       AND NOT EXISTS (SELECT 1 FROM advertisements ad WHERE ad.image_asset_id = a.id)
     ORDER BY a.created_at ASC, a.id ASC
     LIMIT ?1`,
  ).bind(UNUSED_IMAGE_CLEANUP_LIMIT).all<ImageObjectRow>();
  return result.results.map(mapImageObject);
}

export async function deleteUnusedImageAssets(imageIds: readonly string[]): Promise<ImageDeleteResult> {
  const uniqueIds = [...new Set(imageIds.filter(Boolean))];
  if (uniqueIds.length === 0 || uniqueIds.length > MAX_IMAGE_MUTATION_IDS) {
    return { found: [], deleted: [], remainingIds: uniqueIds };
  }

  const placeholders = uniqueIds.map((_, index) => `?${index + 1}`).join(", ");
  const foundResult = await env.DB.prepare(
    `SELECT id, object_key, mime_type
     FROM image_assets
     WHERE id IN (${placeholders})`,
  ).bind(...uniqueIds).all<ImageObjectRow>();
  const found = foundResult.results.map(mapImageObject);
  if (found.length === 0) return { found: [], deleted: [], remainingIds: [] };

  const foundIds = found.map((image) => image.id);
  const foundPlaceholders = foundIds.map((_, index) => `?${index + 1}`).join(", ");
  await env.DB.prepare(
    `DELETE FROM image_assets
     WHERE id IN (${foundPlaceholders})
       AND NOT EXISTS (SELECT 1 FROM site_settings s WHERE s.logo_asset_id = image_assets.id OR s.favicon_asset_id = image_assets.id)
       AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.image_asset_id = image_assets.id)
       AND NOT EXISTS (SELECT 1 FROM products p WHERE p.cover_asset_id = image_assets.id)
       AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.image_asset_id = image_assets.id)
       AND NOT EXISTS (SELECT 1 FROM advertisements ad WHERE ad.image_asset_id = image_assets.id)`,
  ).bind(...foundIds).run();

  const remainingResult = await env.DB.prepare(
    `SELECT id FROM image_assets WHERE id IN (${foundPlaceholders})`,
  ).bind(...foundIds).all<{ id: string }>();
  const remainingIds = remainingResult.results.map((row) => row.id);
  const remaining = new Set(remainingIds);
  return {
    found,
    deleted: found.filter((image) => !remaining.has(image.id)),
    remainingIds,
  };
}
