import { env } from "cloudflare:workers";
import { mapPublicProductRow, type PublicProductCard, type PublicProductRow } from "@/lib/db/public-product-map";
import type { PublicCategoryFilter } from "@/lib/db/public";

type ChannelFilterRow = {
  channel_id: string;
  id: string;
  name: string;
  slug: string;
};

export type PublicDesktopFilterMap = Record<string, PublicCategoryFilter[]>;

export async function loadPublicDesktopFilterMap(
  channelIds: string[],
): Promise<PublicDesktopFilterMap> {
  const uniqueChannelIds = Array.from(new Set(channelIds.filter(Boolean)));
  const output: PublicDesktopFilterMap = Object.fromEntries(
    uniqueChannelIds.map((channelId) => [channelId, []]),
  );
  if (uniqueChannelIds.length === 0) return output;

  const placeholders = uniqueChannelIds.map((_, index) => `?${index + 1}`).join(", ");
  const result = await env.DB.prepare(
    `SELECT filter.channel_id, filter.id, filter.name, filter.slug
     FROM category_filters filter
     WHERE filter.channel_id IN (${placeholders})
       AND filter.status = 'enabled'
       AND EXISTS (
         SELECT 1
         FROM category_filter_relations relation
         INNER JOIN categories category
           ON category.id = relation.category_id
          AND category.channel_id = filter.channel_id
          AND category.status = 'published'
         WHERE relation.filter_id = filter.id
           AND EXISTS (
             SELECT 1
             FROM products product
             WHERE product.channel_id = filter.channel_id
               AND product.category_id = category.id
               AND product.status = 'published'
           )
         LIMIT 1
       )
     ORDER BY filter.channel_id ASC, filter.sort_order ASC, filter.created_at ASC`,
  ).bind(...uniqueChannelIds).all<ChannelFilterRow>();

  result.results.forEach((row) => {
    (output[row.channel_id] ??= []).push({
      id: row.id,
      name: row.name,
      slug: row.slug,
    });
  });
  return output;
}

export async function loadPublicProductPreview(input: {
  channelId: string;
  categoryIds: string[];
  baseUrl: string;
  limit?: number;
}): Promise<PublicProductCard[]> {
  const categoryIds = Array.from(new Set(input.categoryIds.filter(Boolean)));
  if (categoryIds.length === 0) return [];

  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 8), 1), 12);
  const categoryPlaceholders = categoryIds.map((_, index) => `?${index + 2}`).join(", ");
  const bindings: Array<string | number> = [input.channelId, ...categoryIds, limit];
  const limitParameter = bindings.length;

  const result = await env.DB.prepare(
    `SELECT
       product.id,
       product.title,
       product.slug,
       cover.thumbnail_object_key AS object_key,
       cover.thumbnail_width AS cover_width,
       cover.thumbnail_height AS cover_height,
       product.tags
     FROM products product
     INNER JOIN categories category
       ON category.id = product.category_id
      AND category.channel_id = product.channel_id
      AND category.status = 'published'
     INNER JOIN image_assets cover
       ON cover.id = product.cover_asset_id
      AND cover.thumbnail_object_key IS NOT NULL
     WHERE product.channel_id = ?1
       AND product.category_id IN (${categoryPlaceholders})
       AND product.status = 'published'
     ORDER BY product.sort_order ASC, product.created_at DESC
     LIMIT ?${limitParameter}`,
  ).bind(...bindings).all<PublicProductRow>();

  return result.results.map((row) => mapPublicProductRow(row, input.baseUrl));
}
