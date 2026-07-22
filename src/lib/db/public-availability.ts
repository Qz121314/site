import { env } from "cloudflare:workers";
import {
  PUBLIC_PRODUCT_PAGE_SIZE,
  type PublicProductPage,
} from "@/lib/db/public";
import { mapPublicProductRow, type PublicProductRow } from "@/lib/db/public-product-map";

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
       cover.thumbnail_object_key AS object_key,
       cover.thumbnail_width AS cover_width,
       cover.thumbnail_height AS cover_height,
       p.tags
     FROM products p
     INNER JOIN image_assets cover
       ON cover.id = p.cover_asset_id
      AND cover.thumbnail_object_key IS NOT NULL
     WHERE p.channel_id = ?1
       AND p.status = 'published'
       AND p.category_id IS NULL
     ORDER BY p.sort_order ASC, p.created_at DESC
     LIMIT ?2 OFFSET ?3`,
  ).bind(input.channelId, PUBLIC_PRODUCT_PAGE_SIZE + 1, offset).all<PublicProductRow>();

  return {
    products: result.results.slice(0, PUBLIC_PRODUCT_PAGE_SIZE).map((row) => mapPublicProductRow(row, input.baseUrl)),
    page,
    hasMore: result.results.length > PUBLIC_PRODUCT_PAGE_SIZE,
  };
}
