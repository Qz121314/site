import { env } from "cloudflare:workers";
import type { AdCreativeType, AdDeviceType, AdDisplayType, AdOpenMode } from "@/lib/admin/ad-form";
import { buildPublicImageUrl } from "@/lib/images/url";

export const PUBLIC_AD_CANDIDATE_LIMIT_PER_TYPE = 10;

export type PublicAffiliateAdvertisement = {
  id: string;
  name: string;
  displayType: AdDisplayType;
  creativeType: AdCreativeType;
  imageUrl: string | null;
  fallbackImageUrl: string | null;
  mediaUrl: string;
  embedCode: string;
  targetUrl: string;
  width: number;
  height: number;
  openMode: AdOpenMode;
};

export type PublicAffiliateAdCandidates = {
  banners: PublicAffiliateAdvertisement[];
  verticals: PublicAffiliateAdvertisement[];
  modals: PublicAffiliateAdvertisement[];
};

type AdvertisementRow = {
  id: string;
  name: string;
  display_type: AdDisplayType;
  creative_type: AdCreativeType;
  image_asset_id: string | null;
  object_key: string | null;
  image_width: number | null;
  image_height: number | null;
  media_url: string;
  embed_code: string;
  target_url: string;
  declared_width: number | null;
  declared_height: number | null;
  open_mode: AdOpenMode;
  r2_public_base_url: string;
};

type PublicAdvertisementImageRow = {
  object_key: string;
  mime_type: string;
};

function shuffled<T>(values: T[]): T[] {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    const current = output[index] as T;
    output[index] = output[other] as T;
    output[other] = current;
  }
  return output;
}

function fallbackImageUrl(advertisementId: string, imageAssetId: string): string {
  return `/api/public/ads/${encodeURIComponent(advertisementId)}/media/${encodeURIComponent(imageAssetId)}`;
}

function mapAdvertisementRows(rows: AdvertisementRow[]): PublicAffiliateAdvertisement[] {
  return rows.flatMap((row): PublicAffiliateAdvertisement[] => {
    const uploadedImage = row.creative_type === "uploaded_image";
    const imageUrl = uploadedImage && row.object_key
      ? buildPublicImageUrl(row.r2_public_base_url, row.object_key)
      : null;
    const fallbackUrl = uploadedImage && row.image_asset_id && row.object_key
      ? fallbackImageUrl(row.id, row.image_asset_id)
      : null;
    const width = uploadedImage
      ? Number(row.image_width)
      : Number(row.declared_width);
    const height = uploadedImage
      ? Number(row.image_height)
      : Number(row.declared_height);

    if (!Number.isFinite(width) || width < 1 || !Number.isFinite(height) || height < 1) return [];
    if (uploadedImage && !fallbackUrl) return [];

    return [{
      id: row.id,
      name: row.name,
      displayType: row.display_type,
      creativeType: row.creative_type,
      imageUrl,
      fallbackImageUrl: fallbackUrl,
      mediaUrl: row.media_url,
      embedCode: row.embed_code,
      targetUrl: row.target_url,
      width,
      height,
      openMode: row.open_mode,
    }];
  });
}

async function loadCandidateRows(
  channelSlug: string,
  deviceType: AdDeviceType,
  displayType: AdDisplayType,
): Promise<AdvertisementRow[]> {
  const pivot = crypto.randomUUID();
  const query = (comparison: ">=" | "<", limit: number) => env.DB.prepare(
    `SELECT
       advertisement.id,
       advertisement.name,
       advertisement.display_type,
       advertisement.creative_type,
       advertisement.image_asset_id,
       image.object_key,
       image.width AS image_width,
       image.height AS image_height,
       advertisement.media_url,
       advertisement.embed_code,
       advertisement.target_url,
       advertisement.declared_width,
       advertisement.declared_height,
       advertisement.open_mode,
       settings.r2_public_base_url
     FROM channels channel
     INNER JOIN ad_pools pool
       ON pool.channel_id = channel.id
      AND pool.device_type = ?2
      AND pool.status = 'enabled'
     INNER JOIN advertisements advertisement
       ON advertisement.pool_id = pool.id
      AND advertisement.status = 'enabled'
      AND advertisement.display_type = ?3
      AND advertisement.id ${comparison} ?4
     LEFT JOIN image_assets image ON image.id = advertisement.image_asset_id
     INNER JOIN site_settings settings ON settings.id = 1
     WHERE channel.slug = ?1
       AND channel.status = 'published'
     ORDER BY advertisement.id ASC
     LIMIT ?5`,
  ).bind(channelSlug, deviceType, displayType, pivot, limit).all<AdvertisementRow>();

  const first = await query(">=", PUBLIC_AD_CANDIDATE_LIMIT_PER_TYPE);
  const remaining = PUBLIC_AD_CANDIDATE_LIMIT_PER_TYPE - first.results.length;
  if (remaining <= 0) return first.results;

  const wrapped = await query("<", remaining);
  return [...first.results, ...wrapped.results];
}

export async function loadPublicAdvertisementImage(
  advertisementId: string,
  imageAssetId: string,
): Promise<PublicAdvertisementImageRow | null> {
  return env.DB.prepare(
    `SELECT image.object_key, image.mime_type
     FROM advertisements advertisement
     INNER JOIN ad_pools pool
       ON pool.id = advertisement.pool_id
      AND pool.status = 'enabled'
     INNER JOIN channels channel
       ON channel.id = pool.channel_id
      AND channel.status = 'published'
     INNER JOIN image_assets image
       ON image.id = advertisement.image_asset_id
     WHERE advertisement.id = ?1
       AND image.id = ?2
       AND advertisement.status = 'enabled'
       AND advertisement.creative_type = 'uploaded_image'`,
  ).bind(advertisementId, imageAssetId).first<PublicAdvertisementImageRow>();
}

export async function loadPublicAffiliateAdCandidates(
  channelSlug: string,
  deviceType: AdDeviceType,
): Promise<PublicAffiliateAdCandidates> {
  const [bannerRows, verticalRows, modalRows] = await Promise.all([
    loadCandidateRows(channelSlug, deviceType, "banner"),
    loadCandidateRows(channelSlug, deviceType, "vertical"),
    loadCandidateRows(channelSlug, deviceType, "modal"),
  ]);

  return {
    banners: shuffled(mapAdvertisementRows(bannerRows)),
    verticals: shuffled(mapAdvertisementRows(verticalRows)),
    modals: shuffled(mapAdvertisementRows(modalRows)),
  };
}
