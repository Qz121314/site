import { env } from "cloudflare:workers";
import type { AdCreativeType, AdDeviceType, AdDisplayType, AdOpenMode } from "@/lib/admin/ad-form";
import { buildPublicImageUrl } from "@/lib/images/url";

export type PublicAffiliateAdvertisement = {
  id: string;
  name: string;
  displayType: AdDisplayType;
  creativeType: AdCreativeType;
  imageUrl: string | null;
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

function shuffled<T>(values: T[]): T[] {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [output[index], output[other]] = [output[other] as T, output[index] as T];
  }
  return output;
}

export async function loadPublicAffiliateAdCandidates(
  channelSlug: string,
  deviceType: AdDeviceType,
): Promise<PublicAffiliateAdCandidates | null> {
  const result = await env.DB.prepare(
    `SELECT
       advertisement.id,
       advertisement.name,
       advertisement.display_type,
       advertisement.creative_type,
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
     LEFT JOIN image_assets image ON image.id = advertisement.image_asset_id
     INNER JOIN site_settings settings ON settings.id = 1
     WHERE channel.slug = ?1
       AND channel.status = 'published'
     ORDER BY pool.created_at ASC, advertisement.created_at ASC`,
  ).bind(channelSlug, deviceType).all<AdvertisementRow>();

  const channel = await env.DB.prepare(
    "SELECT id FROM channels WHERE slug = ?1 AND status = 'published'",
  ).bind(channelSlug).first<{ id: string }>();
  if (!channel) return null;

  const mapped = result.results.flatMap((row): PublicAffiliateAdvertisement[] => {
    const imageUrl = row.creative_type === "uploaded_image" && row.object_key
      ? buildPublicImageUrl(row.r2_public_base_url, row.object_key)
      : null;
    const width = row.creative_type === "uploaded_image"
      ? Number(row.image_width)
      : Number(row.declared_width);
    const height = row.creative_type === "uploaded_image"
      ? Number(row.image_height)
      : Number(row.declared_height);
    if (!Number.isFinite(width) || width < 1 || !Number.isFinite(height) || height < 1) return [];
    if (row.creative_type === "uploaded_image" && !imageUrl) return [];

    return [{
      id: row.id,
      name: row.name,
      displayType: row.display_type,
      creativeType: row.creative_type,
      imageUrl,
      mediaUrl: row.media_url,
      embedCode: row.embed_code,
      targetUrl: row.target_url,
      width,
      height,
      openMode: row.open_mode,
    }];
  });

  return {
    banners: shuffled(mapped.filter((advertisement) => advertisement.displayType === "banner")),
    verticals: shuffled(mapped.filter((advertisement) => advertisement.displayType === "vertical")),
    modals: shuffled(mapped.filter((advertisement) => advertisement.displayType === "modal")),
  };
}
