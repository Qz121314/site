import { env } from "cloudflare:workers";
import { buildPublicImageUrl } from "@/lib/images/url";
import {
  PUBLIC_PRODUCT_PAGE_SIZE,
  type PublicProductCard,
  type PublicProductPage,
} from "@/lib/db/public";

type ProductCardRow = {
  id: string;
  title: string;
  slug: string;
  object_key: string | null;
  tags: string;
  featured: number;
};

type AvailabilityRow = { available: number };

function parseTags(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string").slice(0, 20)
      : [];
  } catch {
    return [];
  }
}

function mapProduct(row: ProductCardRow, baseUrl: string): PublicProductCard {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    coverUrl: row.object_key ? buildPublicImageUrl(baseUrl, row.object_key) : null,
    tags: parseTags(row.tags),
    featured: row.featured === 1,
  };
}

export async function loadPublicUncategorizedProducts(input: {
  channelId: string;
  baseUrl: string;
  page?: number;
}): Promise<PublicProductPage> {
  const page = Number.isSafeInteger(input.page) && (input.page ?? 0) > 0 ? input.page ?? 1 : 1;
  const offset = (page - 1) * PUBLIC_PRODUCT_PAGE_SIZE;
  const result = await env.DB.prepare(
    `SELECT
       p.id,
       p.title,
       p.slug,
       cover.object_key,
       p.tags,
       p.featured
     FROM products p
     LEFT JOIN image_assets cover ON cover.id = p.cover_asset_id
     WHERE p.channel_id = ?1
       AND p.status = 'published'
       AND p.category_id IS NULL
     ORDER BY p.featured DESC, p.sort_order ASC, p.created_at DESC
     LIMIT ?2 OFFSET ?3`,
  ).bind(input.channelId, PUBLIC_PRODUCT_PAGE_SIZE + 1, offset).all<ProductCardRow>();

  return {
    products: result.results.slice(0, PUBLIC_PRODUCT_PAGE_SIZE).map((row) => mapProduct(row, input.baseUrl)),
    page,
    hasMore: result.results.length > PUBLIC_PRODUCT_PAGE_SIZE,
  };
}

export async function publicProductHasEnabledConversion(productId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT EXISTS(
       SELECT 1
       FROM products product
       INNER JOIN conversion_groups conversion_group
         ON conversion_group.id = product.conversion_group_id
        AND conversion_group.channel_id = product.channel_id
        AND conversion_group.status = 'enabled'
       INNER JOIN conversion_resources resource
         ON resource.group_id = conversion_group.id
        AND resource.status = 'enabled'
       WHERE product.id = ?1
         AND product.status = 'published'
     ) AS available`,
  ).bind(productId).first<AvailabilityRow>();

  return Boolean(row?.available);
}
