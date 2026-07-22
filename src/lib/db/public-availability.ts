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
  cover_width: number | null;
  cover_height: number | null;
  tags: string;
};

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
    coverWidth: row.object_key ? Number(row.cover_width) || null : null,
    coverHeight: row.object_key ? Number(row.cover_height) || null : null,
    tags: parseTags(row.tags),
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
       COALESCE(cover.thumbnail_object_key, cover.object_key) AS object_key,
       CASE WHEN cover.thumbnail_object_key IS NOT NULL THEN cover.thumbnail_width ELSE cover.width END AS cover_width,
       CASE WHEN cover.thumbnail_object_key IS NOT NULL THEN cover.thumbnail_height ELSE cover.height END AS cover_height,
       p.tags
     FROM products p
     LEFT JOIN image_assets cover ON cover.id = p.cover_asset_id
     WHERE p.channel_id = ?1
       AND p.status = 'published'
       AND p.category_id IS NULL
     ORDER BY p.sort_order ASC, p.created_at DESC
     LIMIT ?2 OFFSET ?3`,
  ).bind(input.channelId, PUBLIC_PRODUCT_PAGE_SIZE + 1, offset).all<ProductCardRow>();

  return {
    products: result.results.slice(0, PUBLIC_PRODUCT_PAGE_SIZE).map((row) => mapProduct(row, input.baseUrl)),
    page,
    hasMore: result.results.length > PUBLIC_PRODUCT_PAGE_SIZE,
  };
}
