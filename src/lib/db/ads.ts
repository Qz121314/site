import { env } from "cloudflare:workers";
import type {
  AdCreativeType,
  AdDeviceType,
  AdDisplayType,
  AdOpenMode,
  AdPoolStatus,
  AdStatus,
} from "@/lib/admin/ad-form";
import { buildPublicImageUrl } from "@/lib/images/url";

export type AdminAdvertisement = {
  id: string;
  poolId: string;
  name: string;
  displayType: AdDisplayType;
  creativeType: AdCreativeType;
  imageAssetId: string | null;
  originalName: string;
  width: number | null;
  height: number | null;
  previewUrl: string | null;
  mediaUrl: string;
  embedCode: string;
  targetUrl: string;
  declaredWidth: number | null;
  declaredHeight: number | null;
  openMode: AdOpenMode;
  status: AdStatus;
};

export type AdminAdPool = {
  id: string;
  channelId: string;
  name: string;
  deviceType: AdDeviceType;
  status: AdPoolStatus;
  advertisements: AdminAdvertisement[];
};

type PoolRow = {
  id: string;
  channel_id: string;
  name: string;
  device_type: AdDeviceType;
  status: AdPoolStatus;
};

type AdvertisementRow = {
  id: string;
  pool_id: string;
  name: string;
  display_type: AdDisplayType;
  creative_type: AdCreativeType;
  image_asset_id: string | null;
  original_name: string | null;
  object_key: string | null;
  image_width: number | null;
  image_height: number | null;
  media_url: string;
  embed_code: string;
  target_url: string;
  declared_width: number | null;
  declared_height: number | null;
  open_mode: AdOpenMode;
  status: AdStatus;
};

type BaseUrlRow = { r2_public_base_url: string };

export async function loadAdminAdPools(channelId: string): Promise<AdminAdPool[]> {
  try {
    const [poolResult, adResult, settings] = await Promise.all([
      env.DB.prepare(
        `SELECT id, channel_id, name, device_type, status
         FROM ad_pools
         WHERE channel_id = ?1
         ORDER BY created_at ASC`,
      ).bind(channelId).all<PoolRow>(),
      env.DB.prepare(
        `SELECT
           ad.id,
           ad.pool_id,
           ad.name,
           ad.display_type,
           ad.creative_type,
           ad.image_asset_id,
           image.original_name,
           image.object_key,
           image.width AS image_width,
           image.height AS image_height,
           ad.media_url,
           ad.embed_code,
           ad.target_url,
           ad.declared_width,
           ad.declared_height,
           ad.open_mode,
           ad.status
         FROM advertisements ad
         INNER JOIN ad_pools pool
           ON pool.id = ad.pool_id
          AND pool.channel_id = ?1
         LEFT JOIN image_assets image ON image.id = ad.image_asset_id
         ORDER BY ad.pool_id ASC, ad.created_at ASC`,
      ).bind(channelId).all<AdvertisementRow>(),
      env.DB.prepare(
        "SELECT r2_public_base_url FROM site_settings WHERE id = 1",
      ).first<BaseUrlRow>(),
    ]);

    const baseUrl = settings?.r2_public_base_url ?? "";
    const adsByPool = new Map<string, AdminAdvertisement[]>();
    for (const ad of adResult.results) {
      const advertisements = adsByPool.get(ad.pool_id) ?? [];
      const uploadedPreview = ad.image_asset_id && ad.object_key
        ? buildPublicImageUrl(baseUrl, ad.object_key)
          ?? `/api/admin/images/${encodeURIComponent(ad.image_asset_id)}/content`
        : null;
      const width = ad.creative_type === "uploaded_image"
        ? Number(ad.image_width) || null
        : Number(ad.declared_width) || null;
      const height = ad.creative_type === "uploaded_image"
        ? Number(ad.image_height) || null
        : Number(ad.declared_height) || null;

      advertisements.push({
        id: ad.id,
        poolId: ad.pool_id,
        name: ad.name,
        displayType: ad.display_type,
        creativeType: ad.creative_type,
        imageAssetId: ad.image_asset_id,
        originalName: ad.original_name ?? "",
        width,
        height,
        previewUrl: ad.creative_type === "external_media" ? ad.media_url : uploadedPreview,
        mediaUrl: ad.media_url,
        embedCode: ad.embed_code,
        targetUrl: ad.target_url,
        declaredWidth: Number(ad.declared_width) || null,
        declaredHeight: Number(ad.declared_height) || null,
        openMode: ad.open_mode,
        status: ad.status,
      });
      adsByPool.set(ad.pool_id, advertisements);
    }

    return poolResult.results.map((pool) => ({
      id: pool.id,
      channelId: pool.channel_id,
      name: pool.name,
      deviceType: pool.device_type,
      status: pool.status,
      advertisements: adsByPool.get(pool.id) ?? [],
    }));
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_ad_pools_read_failed", channelId, error: String(error) }));
    throw error;
  }
}
