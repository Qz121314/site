import { env } from "cloudflare:workers";
import type { AdOpenMode, AdPoolStatus, AdStatus } from "@/lib/admin/ad-form";
import { buildPublicImageUrl } from "@/lib/images/url";

export type AdminAdvertisement = {
  id: string;
  poolId: string;
  imageAssetId: string;
  originalName: string;
  width: number;
  height: number;
  previewUrl: string;
  targetUrl: string;
  openMode: AdOpenMode;
  sortOrder: number;
  status: AdStatus;
};

export type AdminAdPool = {
  id: string;
  channelId: string;
  name: string;
  status: AdPoolStatus;
  isBound: boolean;
  advertisements: AdminAdvertisement[];
};

export type AdminAdPoolOption = {
  id: string;
  name: string;
  status: AdPoolStatus;
  advertisementCount: number;
  enabledAdvertisementCount: number;
};

type PoolRow = {
  id: string;
  channel_id: string;
  name: string;
  status: AdPoolStatus;
};

type AdvertisementRow = {
  id: string;
  pool_id: string;
  image_asset_id: string;
  original_name: string;
  object_key: string;
  width: number;
  height: number;
  target_url: string;
  open_mode: AdOpenMode;
  sort_order: number;
  status: AdStatus;
};

type ChannelHeroRow = { hero_ad_pool_id: string | null };
type BaseUrlRow = { r2_public_base_url: string };

export async function loadAdminAdPools(channelId: string): Promise<AdminAdPool[]> {
  try {
    const [poolResult, adResult, channel, settings] = await Promise.all([
      env.DB.prepare(
        `SELECT id, channel_id, name, status
         FROM ad_pools
         WHERE channel_id = ?1
         ORDER BY created_at ASC`,
      ).bind(channelId).all<PoolRow>(),
      env.DB.prepare(
        `SELECT
           ad.id,
           ad.pool_id,
           ad.image_asset_id,
           a.original_name,
           a.object_key,
           a.width,
           a.height,
           ad.target_url,
           ad.open_mode,
           ad.sort_order,
           ad.status
         FROM advertisements ad
         INNER JOIN ad_pools p ON p.id = ad.pool_id AND p.channel_id = ?1
         INNER JOIN image_assets a ON a.id = ad.image_asset_id
         ORDER BY ad.pool_id ASC, ad.sort_order ASC, ad.created_at ASC`,
      ).bind(channelId).all<AdvertisementRow>(),
      env.DB.prepare(
        "SELECT hero_ad_pool_id FROM channels WHERE id = ?1",
      ).bind(channelId).first<ChannelHeroRow>(),
      env.DB.prepare(
        "SELECT r2_public_base_url FROM site_settings WHERE id = 1",
      ).first<BaseUrlRow>(),
    ]);

    const baseUrl = settings?.r2_public_base_url ?? "";
    const adsByPool = new Map<string, AdminAdvertisement[]>();
    for (const ad of adResult.results) {
      const advertisements = adsByPool.get(ad.pool_id) ?? [];
      advertisements.push({
        id: ad.id,
        poolId: ad.pool_id,
        imageAssetId: ad.image_asset_id,
        originalName: ad.original_name,
        width: Number(ad.width),
        height: Number(ad.height),
        previewUrl:
          buildPublicImageUrl(baseUrl, ad.object_key) ??
          `/api/admin/images/${encodeURIComponent(ad.image_asset_id)}/content`,
        targetUrl: ad.target_url,
        openMode: ad.open_mode,
        sortOrder: Number(ad.sort_order),
        status: ad.status,
      });
      adsByPool.set(ad.pool_id, advertisements);
    }

    return poolResult.results.map((pool) => ({
      id: pool.id,
      channelId: pool.channel_id,
      name: pool.name,
      status: pool.status,
      isBound: channel?.hero_ad_pool_id === pool.id,
      advertisements: adsByPool.get(pool.id) ?? [],
    }));
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_ad_pools_read_failed", channelId, error: String(error) }));
    return [];
  }
}

export async function loadAdminAdPoolOptions(channelId: string): Promise<AdminAdPoolOption[]> {
  try {
    const result = await env.DB.prepare(
      `SELECT
         p.id,
         p.name,
         p.status,
         COUNT(ad.id) AS advertisementCount,
         COUNT(CASE WHEN ad.status = 'enabled' THEN 1 END) AS enabledAdvertisementCount
       FROM ad_pools p
       LEFT JOIN advertisements ad ON ad.pool_id = p.id
       WHERE p.channel_id = ?1
       GROUP BY p.id, p.name, p.status, p.created_at
       ORDER BY p.created_at ASC`,
    ).bind(channelId).all<AdminAdPoolOption>();

    return result.results.map((pool) => ({
      ...pool,
      advertisementCount: Number(pool.advertisementCount ?? 0),
      enabledAdvertisementCount: Number(pool.enabledAdvertisementCount ?? 0),
    }));
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_ad_pool_options_read_failed", channelId, error: String(error) }));
    return [];
  }
}

export async function loadChannelHeroAdPoolId(channelId: string): Promise<string | null> {
  try {
    const row = await env.DB.prepare(
      "SELECT hero_ad_pool_id FROM channels WHERE id = ?1",
    ).bind(channelId).first<ChannelHeroRow>();
    return row?.hero_ad_pool_id ?? null;
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_channel_hero_pool_read_failed", channelId, error: String(error) }));
    return null;
  }
}
