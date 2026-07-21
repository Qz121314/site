import { env } from "cloudflare:workers";

type ProductThumbnailRow = {
  product_id: string;
  object_key: string | null;
  r2_public_base_url: string;
};

export type AdminProductThumbnailData = {
  r2PublicBaseUrl: string;
  objectKeyByProductId: Map<string, string>;
};

export async function loadAdminProductThumbnails(productIds: string[]): Promise<AdminProductThumbnailData> {
  const ids = [...new Set(productIds)].slice(0, 50);
  if (ids.length === 0) return { r2PublicBaseUrl: "", objectKeyByProductId: new Map() };

  try {
    const placeholders = ids.map((_, index) => `?${index + 1}`).join(", ");
    const result = await env.DB.prepare(
      `SELECT
         p.id AS product_id,
         asset.object_key,
         settings.r2_public_base_url
       FROM products p
       LEFT JOIN image_assets asset ON asset.id = p.cover_asset_id
       INNER JOIN site_settings settings ON settings.id = 1
       WHERE p.id IN (${placeholders})`,
    ).bind(...ids).all<ProductThumbnailRow>();

    const objectKeyByProductId = new Map<string, string>();
    for (const row of result.results) {
      if (row.object_key) objectKeyByProductId.set(row.product_id, row.object_key);
    }

    return {
      r2PublicBaseUrl: result.results[0]?.r2_public_base_url ?? "",
      objectKeyByProductId,
    };
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_product_thumbnails_read_failed", count: ids.length, error: String(error) }));
    return { r2PublicBaseUrl: "", objectKeyByProductId: new Map() };
  }
}
