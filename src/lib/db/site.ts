import { env } from "cloudflare:workers";

export type SiteSummary = {
  siteName: string;
  siteDescription: string;
  defaultChannelSlug: string | null;
  databaseReady: boolean;
};

type SiteRow = {
  site_name: string;
  site_description: string;
  default_channel_slug: string | null;
};

export async function loadSiteSummary(): Promise<SiteSummary> {
  try {
    const row = await env.DB.prepare(
      `SELECT s.site_name, s.site_description, c.slug AS default_channel_slug
       FROM site_settings s
       LEFT JOIN channels c ON c.id = s.default_channel_id AND c.status = 'published'
       WHERE s.id = 1`,
    ).first<SiteRow>();

    return {
      siteName: row?.site_name ?? "Site",
      siteDescription: row?.site_description ?? "Visual recommendations, updated in real time.",
      defaultChannelSlug: row?.default_channel_slug ?? null,
      databaseReady: true,
    };
  } catch (error) {
    console.error(JSON.stringify({ event: "site_settings_read_failed", error: String(error) }));
    return {
      siteName: "Site",
      siteDescription: "Visual recommendations, updated in real time.",
      defaultChannelSlug: null,
      databaseReady: false,
    };
  }
}

export type AdminCounts = {
  channels: number;
  categories: number;
  products: number;
  images: number;
  databaseReady: boolean;
};

type CountRow = Omit<AdminCounts, "databaseReady">;

export async function loadAdminCounts(): Promise<AdminCounts> {
  try {
    const row = await env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM channels) AS channels,
        (SELECT COUNT(*) FROM categories) AS categories,
        (SELECT COUNT(*) FROM products) AS products,
        (SELECT COUNT(*) FROM image_assets) AS images`,
    ).first<CountRow>();
    return { channels: row?.channels ?? 0, categories: row?.categories ?? 0, products: row?.products ?? 0, images: row?.images ?? 0, databaseReady: true };
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_counts_read_failed", error: String(error) }));
    return { channels: 0, categories: 0, products: 0, images: 0, databaseReady: false };
  }
}
