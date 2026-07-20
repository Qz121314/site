import { env } from "cloudflare:workers";
import { buildPublicImageUrl } from "@/lib/images/url";
import type { PublicProductDetail } from "@/lib/db/public";

type ProductDetailRow = {
  id: string;
  channel_id: string;
  channel_name: string;
  channel_slug: string;
  category_name: string | null;
  category_slug: string | null;
  title: string;
  slug: string;
  object_key: string | null;
  tags: string;
  featured: number;
  body_html: string;
  cta_label: string;
  has_conversion: number;
};

type GalleryRow = {
  id: string;
  object_key: string;
  original_name: string;
  width: number;
  height: number;
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

export async function loadPublicProductDetailWithoutContactLookup(
  channelSlug: string,
  productSlug: string,
  baseUrl: string,
): Promise<PublicProductDetail | null> {
  const row = await env.DB.prepare(
    `SELECT
       p.id,
       p.channel_id,
       c.name AS channel_name,
       c.slug AS channel_slug,
       category.name AS category_name,
       category.slug AS category_slug,
       p.title,
       p.slug,
       cover.object_key,
       p.tags,
       p.featured,
       p.body_html,
       p.cta_label,
       CASE WHEN conversion_group.id IS NULL THEN 0 ELSE 1 END AS has_conversion
     FROM products p
     INNER JOIN channels c ON c.id = p.channel_id AND c.status = 'published'
     LEFT JOIN categories category
       ON category.id = p.category_id
      AND category.channel_id = p.channel_id
      AND category.status = 'published'
     LEFT JOIN image_assets cover ON cover.id = p.cover_asset_id
     LEFT JOIN conversion_groups conversion_group
       ON conversion_group.id = p.conversion_group_id
      AND conversion_group.channel_id = p.channel_id
      AND conversion_group.status = 'enabled'
     WHERE c.slug = ?1
       AND p.slug = ?2
       AND p.status = 'published'
       AND (p.category_id IS NULL OR category.id IS NOT NULL)`,
  ).bind(channelSlug, productSlug).first<ProductDetailRow>();

  if (!row) return null;

  const galleryResult = await env.DB.prepare(
    `SELECT
       a.id,
       a.object_key,
       a.original_name,
       a.width,
       a.height
     FROM product_images pi
     INNER JOIN image_assets a ON a.id = pi.image_asset_id
     WHERE pi.product_id = ?1
     ORDER BY pi.sort_order ASC, a.created_at ASC`,
  ).bind(row.id).all<GalleryRow>();

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    coverUrl: row.object_key ? buildPublicImageUrl(baseUrl, row.object_key) : null,
    tags: parseTags(row.tags),
    featured: row.featured === 1,
    channelId: row.channel_id,
    channelName: row.channel_name,
    channelSlug: row.channel_slug,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    bodyHtml: row.body_html,
    ctaLabel: row.cta_label,
    hasConversion: row.has_conversion === 1,
    gallery: galleryResult.results.flatMap((image) => {
      const imageUrl = buildPublicImageUrl(baseUrl, image.object_key);
      return imageUrl
        ? [{
            id: image.id,
            imageUrl,
            originalName: image.original_name,
            width: Number(image.width),
            height: Number(image.height),
          }]
        : [];
    }),
  };
}
