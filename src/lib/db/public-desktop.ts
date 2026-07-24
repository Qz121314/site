import { env } from "cloudflare:workers";
import { mapPublicProductRow, type PublicProductCard, type PublicProductRow } from "@/lib/db/public-product-map";
import type { PublicCategoryFilter } from "@/lib/db/public";

type ChannelFilterRow = {
  channel_id: string;
  id: string;
  name: string;
  slug: string;
};

type PublicProductPreviewRow = PublicProductRow & {
  preview_key: string;
};

export type PublicDesktopFilterMap = Record<string, PublicCategoryFilter[]>;

export interface PublicDesktopPreviewGroup {
  key: string;
  categoryIds: string[];
  limit?: number;
}

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

export async function loadPublicProductPreviewGroups(input: {
  channelId: string;
  groups: PublicDesktopPreviewGroup[];
  baseUrl: string;
}): Promise<Record<string, PublicProductCard[]>> {
  const seenKeys = new Set<string>();
  const groups = input.groups.flatMap((group) => {
    const key = group.key.trim();
    const categoryIds = Array.from(new Set(group.categoryIds.filter(Boolean)));
    if (!key || seenKeys.has(key) || categoryIds.length === 0) return [];
    seenKeys.add(key);
    return [{
      key,
      categoryIds,
      limit: Math.min(Math.max(Math.trunc(group.limit ?? 8), 1), 12),
    }];
  });

  const output: Record<string, PublicProductCard[]> = Object.fromEntries(
    input.groups.map((group) => [group.key, []]),
  );
  if (!input.channelId || groups.length === 0) return output;

  const bindings: Array<string | number> = [];
  const parameter = (value: string | number): string => {
    bindings.push(value);
    return `?${bindings.length}`;
  };

  const queries = groups.map((group) => {
    const previewKeyParameter = parameter(group.key);
    const channelParameter = parameter(input.channelId);
    const categoryParameters = group.categoryIds.map((categoryId) => parameter(categoryId)).join(", ");
    const limitParameter = parameter(group.limit);

    return `SELECT * FROM (
      SELECT
        ${previewKeyParameter} AS preview_key,
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
      WHERE product.channel_id = ${channelParameter}
        AND product.category_id IN (${categoryParameters})
        AND product.status = 'published'
      ORDER BY product.sort_order ASC, product.created_at DESC
      LIMIT ${limitParameter}
    )`;
  });

  const result = await env.DB.prepare(queries.join(" UNION ALL "))
    .bind(...bindings)
    .all<PublicProductPreviewRow>();

  result.results.forEach((row) => {
    (output[row.preview_key] ??= []).push(mapPublicProductRow(row, input.baseUrl));
  });
  return output;
}

export async function loadPublicProductPreview(input: {
  channelId: string;
  categoryIds: string[];
  baseUrl: string;
  limit?: number;
}): Promise<PublicProductCard[]> {
  const key = "preview";
  const previews = await loadPublicProductPreviewGroups({
    channelId: input.channelId,
    baseUrl: input.baseUrl,
    groups: [{ key, categoryIds: input.categoryIds, limit: input.limit }],
  });
  return previews[key] ?? [];
}
