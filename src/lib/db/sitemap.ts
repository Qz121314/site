import { env } from "cloudflare:workers";

type ChannelEntry = { slug: string; updatedAt: string };
type CategoryEntry = { channelSlug: string; slug: string; updatedAt: string; hasCategoryNavigation: number };
type ProductEntry = { channelSlug: string; slug: string; updatedAt: string };
type SiteUpdateRow = {
  updatedAt: string;
  hasPrivacy: number;
  hasDisclaimer: number;
};

export type PublicSitemapEntries = {
  siteUpdatedAt: string;
  hasPrivacy: boolean;
  hasDisclaimer: boolean;
  channels: ChannelEntry[];
  categories: CategoryEntry[];
  products: ProductEntry[];
};

export async function loadPublicSitemapEntries(): Promise<PublicSitemapEntries> {
  const [site, channels, categories, products] = await Promise.all([
    env.DB.prepare(
      `SELECT
         settings.updated_at AS updatedAt,
         length(trim(settings.privacy_content)) > 0 AS hasPrivacy,
         length(trim(settings.disclaimer_content)) > 0 AS hasDisclaimer
       FROM site_settings settings
       WHERE settings.id = 1`,
    ).first<SiteUpdateRow>(),
    env.DB.prepare(
      `WITH
       category_updates AS (
         SELECT channel_id, MAX(updated_at) AS updated_at
         FROM categories
         WHERE status = 'published'
         GROUP BY channel_id
       ),
       product_updates AS (
         SELECT channel_id, MAX(updated_at) AS updated_at
         FROM products
         WHERE status = 'published'
         GROUP BY channel_id
       ),
       filter_updates AS (
         SELECT channel_id, MAX(updated_at) AS updated_at
         FROM category_filters
         WHERE status = 'enabled'
         GROUP BY channel_id
       ),
       pool_updates AS (
         SELECT channel_id, MAX(updated_at) AS updated_at
         FROM ad_pools
         WHERE status = 'enabled'
         GROUP BY channel_id
       ),
       advertisement_updates AS (
         SELECT pool.channel_id, MAX(advertisement.updated_at) AS updated_at
         FROM advertisements advertisement
         INNER JOIN ad_pools pool ON pool.id = advertisement.pool_id
         WHERE pool.status = 'enabled' AND advertisement.status = 'enabled'
         GROUP BY pool.channel_id
       ),
       conversion_group_updates AS (
         SELECT channel_id, MAX(updated_at) AS updated_at
         FROM conversion_groups
         WHERE status = 'enabled'
         GROUP BY channel_id
       ),
       conversion_resource_updates AS (
         SELECT conversion_group.channel_id, MAX(resource.updated_at) AS updated_at
         FROM conversion_resources resource
         INNER JOIN conversion_groups conversion_group ON conversion_group.id = resource.group_id
         WHERE conversion_group.status = 'enabled' AND resource.status = 'enabled'
         GROUP BY conversion_group.channel_id
       )
       SELECT
         channel.slug,
         MAX(
           channel.updated_at,
           COALESCE(settings.updated_at, channel.updated_at),
           COALESCE(category_updates.updated_at, channel.updated_at),
           COALESCE(product_updates.updated_at, channel.updated_at),
           COALESCE(filter_updates.updated_at, channel.updated_at),
           COALESCE(pool_updates.updated_at, channel.updated_at),
           COALESCE(advertisement_updates.updated_at, channel.updated_at),
           COALESCE(conversion_group_updates.updated_at, channel.updated_at),
           COALESCE(conversion_resource_updates.updated_at, channel.updated_at)
         ) AS updatedAt
       FROM channels channel
       LEFT JOIN site_settings settings ON settings.id = 1
       LEFT JOIN category_updates ON category_updates.channel_id = channel.id
       LEFT JOIN product_updates ON product_updates.channel_id = channel.id
       LEFT JOIN filter_updates ON filter_updates.channel_id = channel.id
       LEFT JOIN pool_updates ON pool_updates.channel_id = channel.id
       LEFT JOIN advertisement_updates ON advertisement_updates.channel_id = channel.id
       LEFT JOIN conversion_group_updates ON conversion_group_updates.channel_id = channel.id
       LEFT JOIN conversion_resource_updates ON conversion_resource_updates.channel_id = channel.id
       WHERE channel.status = 'published'`,
    ).all<ChannelEntry>(),
    env.DB.prepare(
      `WITH product_updates AS (
         SELECT category_id, MAX(updated_at) AS updated_at
         FROM products
         WHERE category_id IS NOT NULL AND status = 'published'
         GROUP BY category_id
       )
       SELECT
         channel.slug AS channelSlug,
         category.slug,
         EXISTS(
           SELECT 1 FROM category_filters category_filter
           WHERE category_filter.channel_id = category.channel_id
             AND category_filter.status = 'enabled'
         ) AS hasCategoryNavigation,
         MAX(
           category.updated_at,
           channel.updated_at,
           COALESCE(settings.updated_at, category.updated_at),
           COALESCE(product_updates.updated_at, category.updated_at)
         ) AS updatedAt
       FROM categories category
       INNER JOIN channels channel
         ON channel.id = category.channel_id
        AND channel.status = 'published'
       LEFT JOIN site_settings settings ON settings.id = 1
       LEFT JOIN product_updates ON product_updates.category_id = category.id
       WHERE category.status = 'published'
         AND EXISTS (
           SELECT 1 FROM products product
           WHERE product.category_id = category.id
             AND product.status = 'published'
         )`,
    ).all<CategoryEntry>(),
    env.DB.prepare(
      `WITH resource_updates AS (
         SELECT group_id, MAX(updated_at) AS updated_at
         FROM conversion_resources
         WHERE status = 'enabled'
         GROUP BY group_id
       )
       SELECT
         channel.slug AS channelSlug,
         product.slug,
         MAX(
           product.updated_at,
           channel.updated_at,
           COALESCE(settings.updated_at, product.updated_at),
           COALESCE(category.updated_at, product.updated_at),
           COALESCE(conversion_group.updated_at, product.updated_at),
           COALESCE(resource_updates.updated_at, product.updated_at)
         ) AS updatedAt
       FROM products product
       INNER JOIN channels channel
         ON channel.id = product.channel_id
        AND channel.status = 'published'
       LEFT JOIN site_settings settings ON settings.id = 1
       LEFT JOIN categories category
         ON category.id = product.category_id
        AND category.channel_id = product.channel_id
       LEFT JOIN conversion_groups conversion_group
         ON conversion_group.id = product.conversion_group_id
        AND conversion_group.channel_id = product.channel_id
       LEFT JOIN resource_updates ON resource_updates.group_id = conversion_group.id
       WHERE product.status = 'published'
         AND (product.category_id IS NULL OR category.status = 'published')`,
    ).all<ProductEntry>(),
  ]);

  const fallbackUpdatedAt = new Date(0).toISOString();
  return {
    siteUpdatedAt: site?.updatedAt ?? fallbackUpdatedAt,
    hasPrivacy: Boolean(site?.hasPrivacy),
    hasDisclaimer: Boolean(site?.hasDisclaimer),
    channels: channels.results,
    categories: categories.results,
    products: products.results,
  };
}
