import { env } from "cloudflare:workers";

export const ADMIN_IMAGE_PAGE_SIZE = 48;
export const UNUSED_IMAGE_CLEANUP_LIMIT = 100;

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

export type AdminImagePage = {
  images: AdminImageAsset[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  databaseReady: boolean;
  r2PublicBaseUrl: string;
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
};

type CountRow = { total: number };
type BaseUrlRow = { r2_public_base_url: string };

const usageSelect = `
  SELECT
    a.id,
    a.object_key,
    a.original_name,
    a.mime_type,
    a.width,
    a.height,
    a.size_bytes,
    a.created_at,
    (SELECT COUNT(*) FROM site_settings s WHERE s.logo_asset_id = a.id) AS logo_references,
    (SELECT COUNT(*) FROM site_settings s WHERE s.favicon_asset_id = a.id) AS favicon_references,
    (SELECT COUNT(*) FROM categories c WHERE c.image_asset_id = a.id) AS category_references,
    (SELECT COUNT(*) FROM products p WHERE p.cover_asset_id = a.id) AS product_cover_references,
    (SELECT COUNT(*) FROM product_images pi WHERE pi.image_asset_id = a.id) AS product_gallery_references,
    (SELECT COUNT(*) FROM advertisements ad WHERE ad.image_asset_id = a.id) AS advertisement_references,
    (
      (SELECT COUNT(*) FROM site_settings s WHERE s.logo_asset_id = a.id) +
      (SELECT COUNT(*) FROM site_settings s WHERE s.favicon_asset_id = a.id) +
      (SELECT COUNT(*) FROM categories c WHERE c.image_asset_id = a.id) +
      (SELECT COUNT(*) FROM products p WHERE p.cover_asset_id = a.id) +
      (SELECT COUNT(*) FROM product_images pi WHERE pi.image_asset_id = a.id) +
      (SELECT COUNT(*) FROM advertisements ad WHERE ad.image_asset_id = a.id)
    ) AS reference_count
  FROM image_assets a
`;

function normalizePage(value: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}

function normalizeFilter(value: string): AdminImageFilter {
  return ADMIN_IMAGE_FILTERS.includes(value as AdminImageFilter) ? (value as AdminImageFilter) : "all";
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/gu, "\\$&");
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

export async function loadAdminImagePage(input: {
  query?: string;
  filter?: string;
  page?: number;
}): Promise<AdminImagePage> {
  const query = (input.query ?? "").trim().slice(0, 180);
  const filter = normalizeFilter(input.filter ?? "all");
  const requestedPage = normalizePage(input.page ?? 1);

  try {
    const where = buildWhere(query, filter);
    const countStatement = env.DB.prepare(
      `WITH images_with_usage AS (${usageSelect})
       SELECT COUNT(*) AS total FROM images_with_usage ${where.sql}`,
    ).bind(...where.bindings);
    const baseUrlPromise = loadR2PublicBaseUrl();
    const countRow = await countStatement.first<CountRow>();
    const total = Number(countRow?.total ?? 0);
    const pageCount = Math.max(1, Math.ceil(total / ADMIN_IMAGE_PAGE_SIZE));
    const page = Math.min(requestedPage, pageCount);
    const offset = (page - 1) * ADMIN_IMAGE_PAGE_SIZE;

    const result = await env.DB.prepare(
      `WITH images_with_usage AS (${usageSelect})
       SELECT * FROM images_with_usage
       ${where.sql}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    ).bind(...where.bindings, ADMIN_IMAGE_PAGE_SIZE, offset).all<AdminImageRow>();

    return {
      images: result.results.map(mapImage),
      total,
      page,
      pageCount,
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
    `WITH images_with_usage AS (${usageSelect})
     SELECT * FROM images_with_usage WHERE id = ?1`,
  ).bind(imageId).first<AdminImageRow>();
  return row ? mapImage(row) : null;
}

export async function loadUnusedImagesForCleanup(): Promise<AdminImageAsset[]> {
  const result = await env.DB.prepare(
    `WITH images_with_usage AS (${usageSelect})
     SELECT * FROM images_with_usage
     WHERE reference_count = 0
       AND created_at <= datetime('now', '-24 hours')
     ORDER BY created_at ASC, id ASC
     LIMIT ?1`,
  ).bind(UNUSED_IMAGE_CLEANUP_LIMIT).all<AdminImageRow>();
  return result.results.map(mapImage);
}
