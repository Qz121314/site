import { env } from "cloudflare:workers";
import type { ProductStatus } from "@/lib/admin/product-form";

export const ADMIN_PRODUCT_PAGE_SIZE = 30;

export type AdminProductListItem = {
  id: string;
  title: string;
  slug: string;
  categoryName: string | null;
  coverAssetId: string | null;
  coverObjectKey: string | null;
  featured: boolean;
  sortOrder: number;
  status: ProductStatus;
};

export type AdminProduct = {
  id: string;
  channelId: string;
  title: string;
  slug: string;
  categoryId: string | null;
  categoryName: string | null;
  conversionGroupId: string | null;
  conversionGroupName: string | null;
  conversionGroupStatus: string | null;
  coverAssetId: string | null;
  tags: string[];
  ctaLabel: string;
  featured: boolean;
  sortOrder: number;
  status: ProductStatus;
  imageCount: number;
  bodySource: string;
  bodyHtml: string;
};

export type AdminProductCategoryOption = {
  id: string;
  name: string;
  status: string;
  filterIds: string[];
};

export type AdminProductCategoryListOption = {
  id: string;
  name: string;
};

export type AdminProductFilterOption = {
  id: string;
  name: string;
  status: string;
};

export type AdminProductConversionOption = {
  id: string;
  name: string;
  status: string;
  enabledResourceCount: number;
};

export type AdminProductOptions = {
  categories: AdminProductCategoryOption[];
  filters: AdminProductFilterOption[];
  conversionGroups: AdminProductConversionOption[];
};

export type AdminProductListFilters = {
  query: string;
  status: string;
  categoryId: string;
  page: number;
};

export type AdminProductPage = {
  products: AdminProductListItem[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  r2PublicBaseUrl: string;
};

type AdminProductListRow = {
  id: string;
  title: string;
  slug: string;
  category_name: string | null;
  cover_asset_id: string | null;
  cover_object_key: string | null;
  featured: number;
  sort_order: number;
  status: ProductStatus;
  r2_public_base_url: string;
};

type AdminProductRow = {
  id: string;
  channel_id: string;
  title: string;
  slug: string;
  category_id: string | null;
  category_name: string | null;
  conversion_group_id: string | null;
  conversion_group_name: string | null;
  conversion_group_status: string | null;
  cover_asset_id: string | null;
  tags: string;
  body_source: string;
  body_html: string;
  cta_label: string;
  featured: number;
  sort_order: number;
  status: ProductStatus;
  image_count: number;
};

type AdminProductCategoryOptionRow = {
  id: string;
  name: string;
  status: string;
  filter_ids: string | null;
};

function parseTags(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function mapProduct(row: AdminProductRow): AdminProduct {
  return {
    id: row.id,
    channelId: row.channel_id,
    title: row.title,
    slug: row.slug,
    categoryId: row.category_id,
    categoryName: row.category_name,
    conversionGroupId: row.conversion_group_id,
    conversionGroupName: row.conversion_group_name,
    conversionGroupStatus: row.conversion_group_status,
    coverAssetId: row.cover_asset_id,
    tags: parseTags(row.tags),
    ctaLabel: row.cta_label,
    featured: row.featured === 1,
    sortOrder: row.sort_order,
    status: row.status,
    imageCount: Number(row.image_count ?? 0),
    bodySource: row.body_source,
    bodyHtml: row.body_html,
  };
}

async function readAdminProductCategories(channelId: string): Promise<AdminProductCategoryOption[]> {
  const result = await env.DB.prepare(
    `SELECT
       c.id,
       c.name,
       c.status,
       GROUP_CONCAT(DISTINCT relation.filter_id) AS filter_ids
     FROM categories c
     LEFT JOIN category_filter_relations relation ON relation.category_id = c.id
     WHERE c.channel_id = ?1
     GROUP BY c.id, c.name, c.status, c.sort_order, c.created_at
     ORDER BY c.sort_order ASC, c.created_at ASC`,
  ).bind(channelId).all<AdminProductCategoryOptionRow>();

  return result.results.map((category) => ({
    id: category.id,
    name: category.name,
    status: category.status,
    filterIds: category.filter_ids ? category.filter_ids.split(",").filter(Boolean) : [],
  }));
}

export async function loadAdminProductCategoryList(
  channelId: string,
): Promise<AdminProductCategoryListOption[]> {
  try {
    const result = await env.DB.prepare(
      `SELECT id, name
       FROM categories
       WHERE channel_id = ?1
       ORDER BY sort_order ASC, created_at ASC`,
    ).bind(channelId).all<AdminProductCategoryListOption>();
    return result.results;
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_product_category_list_read_failed", channelId, error: String(error) }));
    return [];
  }
}

export async function loadAdminProductOptions(channelId: string): Promise<AdminProductOptions> {
  try {
    const [categories, filterResult, groupResult] = await Promise.all([
      readAdminProductCategories(channelId),
      env.DB.prepare(
        `SELECT id, name, status
         FROM category_filters
         WHERE channel_id = ?1
         ORDER BY sort_order ASC, created_at ASC`,
      ).bind(channelId).all<AdminProductFilterOption>(),
      env.DB.prepare(
        `SELECT
           g.id,
           g.name,
           g.status,
           COUNT(CASE WHEN r.status = 'enabled' THEN 1 END) AS enabledResourceCount
         FROM conversion_groups g
         LEFT JOIN conversion_resources r ON r.group_id = g.id
         WHERE g.channel_id = ?1
         GROUP BY g.id, g.name, g.status, g.created_at
         ORDER BY g.created_at ASC`,
      ).bind(channelId).all<AdminProductConversionOption>(),
    ]);

    return {
      categories,
      filters: filterResult.results,
      conversionGroups: groupResult.results.map((group) => ({
        ...group,
        enabledResourceCount: Number(group.enabledResourceCount ?? 0),
      })),
    };
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_product_options_read_failed", channelId, error: String(error) }));
    return { categories: [], filters: [], conversionGroups: [] };
  }
}

export async function loadNextAdminProductSortOrder(channelId: string): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COALESCE(MAX(sort_order), -10) + 10 AS next_sort_order FROM products WHERE channel_id = ?1",
  ).bind(channelId).first<{ next_sort_order: number }>();
  return Number(row?.next_sort_order ?? 0);
}

export async function loadAdminProducts(
  channelId: string,
  filters: AdminProductListFilters,
): Promise<AdminProductPage> {
  const query = filters.query.trim().slice(0, 100);
  const status = filters.status.trim();
  const categoryId = filters.categoryId.trim();
  const requestedPage = Number.isSafeInteger(filters.page) && filters.page > 0 ? filters.page : 1;

  try {
    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) AS total
       FROM products p
       WHERE p.channel_id = ?1
         AND (?2 = '' OR p.title LIKE '%' || ?2 || '%' OR p.slug LIKE '%' || ?2 || '%' OR p.tags LIKE '%' || ?2 || '%')
         AND (?3 = '' OR p.status = ?3)
         AND (?4 = '' OR p.category_id = ?4)`,
    ).bind(channelId, query, status, categoryId).first<{ total: number }>();

    const total = Number(countRow?.total ?? 0);
    const pageCount = Math.max(1, Math.ceil(total / ADMIN_PRODUCT_PAGE_SIZE));
    const page = Math.min(requestedPage, pageCount);
    const offset = (page - 1) * ADMIN_PRODUCT_PAGE_SIZE;

    const result = await env.DB.prepare(
      `SELECT
         p.id,
         p.title,
         p.slug,
         c.name AS category_name,
         p.cover_asset_id,
         cover.object_key AS cover_object_key,
         p.featured,
         p.sort_order,
         p.status,
         COALESCE(settings.r2_public_base_url, '') AS r2_public_base_url
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id AND c.channel_id = p.channel_id
       LEFT JOIN image_assets cover ON cover.id = p.cover_asset_id
       LEFT JOIN site_settings settings ON settings.id = 1
       WHERE p.channel_id = ?1
         AND (?2 = '' OR p.title LIKE '%' || ?2 || '%' OR p.slug LIKE '%' || ?2 || '%' OR p.tags LIKE '%' || ?2 || '%')
         AND (?3 = '' OR p.status = ?3)
         AND (?4 = '' OR p.category_id = ?4)
       ORDER BY p.featured DESC, p.sort_order ASC, p.created_at DESC
       LIMIT ?5 OFFSET ?6`,
    ).bind(channelId, query, status, categoryId, ADMIN_PRODUCT_PAGE_SIZE, offset).all<AdminProductListRow>();

    return {
      products: result.results.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        categoryName: row.category_name,
        coverAssetId: row.cover_asset_id,
        coverObjectKey: row.cover_object_key,
        featured: row.featured === 1,
        sortOrder: Number(row.sort_order),
        status: row.status,
      })),
      total,
      page,
      pageCount,
      pageSize: ADMIN_PRODUCT_PAGE_SIZE,
      r2PublicBaseUrl: result.results[0]?.r2_public_base_url ?? "",
    };
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_products_read_failed", channelId, error: String(error) }));
    return {
      products: [],
      total: 0,
      page: 1,
      pageCount: 1,
      pageSize: ADMIN_PRODUCT_PAGE_SIZE,
      r2PublicBaseUrl: "",
    };
  }
}

export async function loadAdminProduct(channelId: string, productId: string): Promise<AdminProduct | null> {
  try {
    const row = await env.DB.prepare(
      `SELECT
         p.id,
         p.channel_id,
         p.title,
         p.slug,
         p.category_id,
         c.name AS category_name,
         p.conversion_group_id,
         g.name AS conversion_group_name,
         g.status AS conversion_group_status,
         p.cover_asset_id,
         p.tags,
         p.body_source,
         p.body_html,
         p.cta_label,
         p.featured,
         p.sort_order,
         p.status,
         COUNT(DISTINCT pi.image_asset_id) AS image_count
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id AND c.channel_id = p.channel_id
       LEFT JOIN conversion_groups g ON g.id = p.conversion_group_id AND g.channel_id = p.channel_id
       LEFT JOIN product_images pi ON pi.product_id = p.id
       WHERE p.id = ?1 AND p.channel_id = ?2
       GROUP BY
         p.id, p.channel_id, p.title, p.slug, p.category_id, c.name,
         p.conversion_group_id, g.name, g.status, p.cover_asset_id,
         p.tags, p.body_source, p.body_html, p.cta_label,
         p.featured, p.sort_order, p.status`,
    ).bind(productId, channelId).first<AdminProductRow>();

    return row ? mapProduct(row) : null;
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_product_read_failed", channelId, productId, error: String(error) }));
    return null;
  }
}
