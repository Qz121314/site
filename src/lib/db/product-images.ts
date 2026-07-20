import { env } from "cloudflare:workers";
import { buildPublicImageUrl } from "@/lib/images/url";

export type AdminProductImage = {
  imageAssetId: string;
  originalName: string;
  width: number;
  height: number;
  sortOrder: number;
  previewUrl: string;
};

type ProductImageRow = {
  image_asset_id: string;
  object_key: string;
  original_name: string;
  width: number;
  height: number;
  sort_order: number;
};

type BaseUrlRow = { r2_public_base_url: string };

export async function loadAdminProductImages(
  channelId: string,
  productId: string,
): Promise<AdminProductImage[]> {
  try {
    const [result, settings] = await Promise.all([
      env.DB.prepare(
        `SELECT
           pi.image_asset_id,
           a.object_key,
           a.original_name,
           a.width,
           a.height,
           pi.sort_order
         FROM product_images pi
         INNER JOIN products p ON p.id = pi.product_id AND p.channel_id = ?1
         INNER JOIN image_assets a ON a.id = pi.image_asset_id
         WHERE pi.product_id = ?2
         ORDER BY pi.sort_order ASC, a.created_at ASC`,
      ).bind(channelId, productId).all<ProductImageRow>(),
      env.DB.prepare(
        "SELECT r2_public_base_url FROM site_settings WHERE id = 1",
      ).first<BaseUrlRow>(),
    ]);

    const baseUrl = settings?.r2_public_base_url ?? "";
    return result.results.map((image) => ({
      imageAssetId: image.image_asset_id,
      originalName: image.original_name,
      width: Number(image.width),
      height: Number(image.height),
      sortOrder: Number(image.sort_order),
      previewUrl:
        buildPublicImageUrl(baseUrl, image.object_key) ??
        `/api/admin/images/${encodeURIComponent(image.image_asset_id)}/content`,
    }));
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_product_images_read_failed", channelId, productId, error: String(error) }));
    return [];
  }
}
