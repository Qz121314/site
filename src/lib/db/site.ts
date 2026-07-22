import { env } from "cloudflare:workers";

export type AdminSiteSettings = {
  siteName: string;
  siteDescription: string;
  logoAssetId: string | null;
  faviconAssetId: string | null;
  defaultChannelId: string | null;
  r2PublicBaseUrl: string;
  ga4Id: string;
  metaPixelId: string;
  adultGateEnabled: boolean;
  privacyContent: string;
  disclaimerContent: string;
  databaseReady: boolean;
};

type AdminSiteSettingsRow = {
  site_name: string;
  site_description: string;
  logo_asset_id: string | null;
  favicon_asset_id: string | null;
  default_channel_id: string | null;
  r2_public_base_url: string;
  ga4_id: string;
  meta_pixel_id: string;
  adult_gate_enabled: number;
  privacy_content: string;
  disclaimer_content: string;
};

export async function loadAdminSiteSettings(): Promise<AdminSiteSettings> {
  try {
    const row = await env.DB.prepare(
      `SELECT
         site_name,
         site_description,
         logo_asset_id,
         favicon_asset_id,
         default_channel_id,
         r2_public_base_url,
         ga4_id,
         meta_pixel_id,
         adult_gate_enabled,
         privacy_content,
         disclaimer_content
       FROM site_settings
       WHERE id = 1`,
    ).first<AdminSiteSettingsRow>();

    if (!row) throw new Error("site_settings row is missing");

    return {
      siteName: row.site_name,
      siteDescription: row.site_description,
      logoAssetId: row.logo_asset_id,
      faviconAssetId: row.favicon_asset_id,
      defaultChannelId: row.default_channel_id,
      r2PublicBaseUrl: row.r2_public_base_url,
      ga4Id: row.ga4_id,
      metaPixelId: row.meta_pixel_id,
      adultGateEnabled: row.adult_gate_enabled === 1,
      privacyContent: row.privacy_content,
      disclaimerContent: row.disclaimer_content,
      databaseReady: true,
    };
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_site_settings_read_failed", error: String(error) }));
    throw error;
  }
}

export type AdminChannel = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  sortOrder: number;
  status: "draft" | "published" | "disabled";
};

type AdminChannelRow = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  sort_order: number;
  status: AdminChannel["status"];
};

function mapAdminChannel(row: AdminChannelRow): AdminChannel {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    sortOrder: row.sort_order,
    status: row.status,
  };
}

export async function loadAdminChannels(): Promise<AdminChannel[]> {
  try {
    const result = await env.DB.prepare(
      `SELECT id, name, slug, icon, sort_order, status
       FROM channels
       ORDER BY sort_order ASC, created_at ASC`,
    ).all<AdminChannelRow>();

    return result.results.map(mapAdminChannel);
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_channels_read_failed", error: String(error) }));
    throw error;
  }
}

export async function loadAdminChannel(channelId: string): Promise<AdminChannel | null> {
  try {
    const row = await env.DB.prepare(
      `SELECT id, name, slug, icon, sort_order, status
       FROM channels
       WHERE id = ?1`,
    ).bind(channelId).first<AdminChannelRow>();

    return row ? mapAdminChannel(row) : null;
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_channel_read_failed", channelId, error: String(error) }));
    throw error;
  }
}

export type AdminCategoryFilter = {
  id: string;
  channelId: string;
  name: string;
  slug: string;
  sortOrder: number;
  status: "enabled" | "disabled";
  categoryCount: number;
};

type AdminCategoryFilterRow = {
  id: string;
  channel_id: string;
  name: string;
  slug: string;
  sort_order: number;
  status: AdminCategoryFilter["status"];
  category_count: number;
};

export async function loadAdminCategoryFilters(channelId: string): Promise<AdminCategoryFilter[]> {
  try {
    const result = await env.DB.prepare(
      `SELECT
         f.id,
         f.channel_id,
         f.name,
         f.slug,
         f.sort_order,
         f.status,
         COUNT(r.category_id) AS category_count
       FROM category_filters f
       LEFT JOIN category_filter_relations r ON r.filter_id = f.id
       WHERE f.channel_id = ?1
       GROUP BY f.id, f.channel_id, f.name, f.slug, f.sort_order, f.status
       ORDER BY f.sort_order ASC, f.created_at ASC`,
    ).bind(channelId).all<AdminCategoryFilterRow>();

    return result.results.map((row) => ({
      id: row.id,
      channelId: row.channel_id,
      name: row.name,
      slug: row.slug,
      sortOrder: row.sort_order,
      status: row.status,
      categoryCount: row.category_count,
    }));
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_category_filters_read_failed", channelId, error: String(error) }));
    throw error;
  }
}
