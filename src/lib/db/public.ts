import { env } from "cloudflare:workers";
import { buildPublicImageUrl } from "@/lib/images/url";

export const PUBLIC_PRODUCT_PAGE_SIZE = 20;

export type PublicChannelNavItem = {
  name: string;
  slug: string;
  icon: string;
};

export type PublicSiteShell = {
  siteName: string;
  siteDescription: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  r2PublicBaseUrl: string;
  ga4Id: string;
  metaPixelId: string;
  adultGateEnabled: boolean;
  noindexEnabled: boolean;
  allFilterLabel: string;
  privacyContent: string;
  disclaimerContent: string;
  channels: PublicChannelNavItem[];
};

export type PublicChannel = {
  id: string;
  name: string;
  slug: string;
  icon: string;
};

export type PublicHeroAdvertisement = {
  id: string;
  imageUrl: string;
  targetUrl: string;
  openMode: "same" | "new";
};

export type PublicCategoryFilter = {
  id: string;
  name: string;
  slug: string;
};

export type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  filterIds: string[];
  productCount: number;
};

export type PublicProductCard = {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  tags: string[];
  featured: boolean;
};

export type PublicProductPage = {
  products: PublicProductCard[];
  page: number;
  hasMore: boolean;
};

export type PublicProductDetail = PublicProductCard & {
  channelId: string;
  channelName: string;
  channelSlug: string;
  categoryName: string | null;
  categorySlug: string | null;
  bodyHtml: string;
  ctaLabel: string;
  hasConversion: boolean;
  gallery: Array<{
    id: string;
    imageUrl: string;
    originalName: string;
    width: number;
    height: number;
  }>;
};

export type PublicSearchResults = {
  categories: PublicCategory[];
  products: PublicProductCard[];
};

type SiteRow = {
  site_name: string;
  site_description: string;
  r2_public_base_url: string;
  ga4_id: string;
  meta_pixel_id: string;
  adult_gate_enabled: number;
  noindex_enabled: number;
  all_filter_label: string;
  privacy_content: string;
  disclaimer_content: string;
  logo_object_key: string | null;
  favicon_object_key: string | null;
};

type ChannelRow = {
  id: string;
  name: string;
  slug: string;
  icon: string;
};

type HeroRow = {
  id: string;
  object_key: string;
  target_url: string;
  open_mode: "same" | "new";
};

type FilterRow = {
  id: string;
  name: string;
  slug: string;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  object_key: string | null;
  filter_ids: string | null;
  product_count: number;
};

type ProductCardRow = {
  id: string;
  title: string;
  slug: string;
  object_key: string | null;
  tags: string;
  featured: number;
};

type ProductDetailRow = ProductCardRow & {
  channel_id: string;
  channel_name: string;
  channel_slug: string;
  category_name: string | null;
  category_slug: string | null;
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

function mapProduct(row: ProductCardRow, baseUrl: string): PublicProductCard {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    coverUrl: row.object_key ? buildPublicImageUrl(baseUrl, row.object_key) : null,
    tags: parseTags(row.tags),
    featured: row.featured === 1,
  };
}

function mapCategory(row: CategoryRow, baseUrl: string): PublicCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    imageUrl: row.object_key ? buildPublicImageUrl(baseUrl, row.object_key) : null,
    filterIds: row.filter_ids ? row.filter_ids.split(",").filter(Boolean) : [],
    productCount: Number(row.product_count ?? 0),
  };
}

export async function loadPublicSiteShell(): Promise<PublicSiteShell> {
  try {
    const [site, channels] = await Promise.all([
      env.DB.prepare(
        `SELECT
           s.site_name,
           s.site_description,
           s.r2_public_base_url,
           s.ga4_id,
           s.meta_pixel_id,
           s.adult_gate_enabled,
           s.noindex_enabled,
           s.all_filter_label,
           s.privacy_content,
           s.disclaimer_content,
           logo.object_key AS logo_object_key,
           favicon.object_key AS favicon_object_key
         FROM site_settings s
         LEFT JOIN image_assets logo ON logo.id = s.logo_asset_id
         LEFT JOIN image_assets favicon ON favicon.id = s.favicon_asset_id
         WHERE s.id = 1`,
      ).first<SiteRow>(),
      env.DB.prepare(
        `SELECT id, name, slug, icon
         FROM channels
         WHERE status = 'published'
         ORDER BY sort_order ASC, created_at ASC`,
      ).all<ChannelRow>(),
    ]);

    const baseUrl = site?.r2_public_base_url ?? "";
    return {
      siteName: site?.site_name ?? "Site",
      siteDescription: site?.site_description ?? "Visual recommendations, updated in real time.",
      logoUrl: site?.logo_object_key ? buildPublicImageUrl(baseUrl, site.logo_object_key) : null,
      faviconUrl: site?.favicon_object_key ? buildPublicImageUrl(baseUrl, site.favicon_object_key) : null,
      r2PublicBaseUrl: baseUrl,
      ga4Id: site?.ga4_id ?? "",
      metaPixelId: site?.meta_pixel_id ?? "",
      adultGateEnabled: site?.adult_gate_enabled === 1,
      noindexEnabled: site?.noindex_enabled === 1,
      allFilterLabel: site?.all_filter_label || "All",
      privacyContent: site?.privacy_content ?? "",
      disclaimerContent: site?.disclaimer_content ?? "",
      channels: channels.results.map((channel) => ({
        name: channel.name,
        slug: channel.slug,
        icon: channel.icon,
      })),
    };
  } catch (error) {
    console.error(JSON.stringify({ event: "public_site_shell_read_failed", error: String(error) }));
    return {
      siteName: "Site",
      siteDescription: "Visual recommendations, updated in real time.",
      logoUrl: null,
      faviconUrl: null,
      r2PublicBaseUrl: "",
      ga4Id: "",
      metaPixelId: "",
      adultGateEnabled: false,
      noindexEnabled: true,
      allFilterLabel: "All",
      privacyContent: "",
      disclaimerContent: "",
      channels: [],
    };
  }
}

export async function loadPublicChannel(channelSlug: string): Promise<PublicChannel | null> {
  const row = await env.DB.prepare(
    `SELECT id, name, slug, icon
     FROM channels
     WHERE slug = ?1 AND status = 'published'`,
  ).bind(channelSlug).first<ChannelRow>();
  return row ? { id: row.id, name: row.name, slug: row.slug, icon: row.icon } : null;
}

export async function loadPublicHeroAdvertisements(
  channelId: string,
  baseUrl: string,
): Promise<PublicHeroAdvertisement[]> {
  const result = await env.DB.prepare(
    `SELECT ad.id, a.object_key, ad.target_url, ad.open_mode
     FROM channels c
     INNER JOIN ad_pools p
       ON p.id = c.hero_ad_pool_id
      AND p.channel_id = c.id
      AND p.status = 'enabled'
     INNER JOIN advertisements ad
       ON ad.pool_id = p.id
      AND ad.status = 'enabled'
     INNER JOIN image_assets a ON a.id = ad.image_asset_id
     WHERE c.id = ?1 AND c.status = 'published'
     ORDER BY ad.sort_order ASC, ad.created_at ASC`,
  ).bind(channelId).all<HeroRow>();

  return result.results.flatMap((row) => {
    const imageUrl = buildPublicImageUrl(baseUrl, row.object_key);
    return imageUrl
      ? [{ id: row.id, imageUrl, targetUrl: row.target_url, openMode: row.open_mode }]
      : [];
  });
}

export async function loadPublicCategoryFilters(channelId: string): Promise<PublicCategoryFilter[]> {
  const result = await env.DB.prepare(
    `SELECT id, name, slug
     FROM category_filters
     WHERE channel_id = ?1 AND status = 'enabled'
     ORDER BY sort_order ASC, created_at ASC`,
  ).bind(channelId).all<FilterRow>();
  return result.results;
}

export async function loadPublicCategories(
  channelId: string,
  baseUrl: string,
): Promise<PublicCategory[]> {
  const result = await env.DB.prepare(
    `SELECT
       c.id,
       c.name,
       c.slug,
       a.object_key,
       GROUP_CONCAT(DISTINCT CASE WHEN f.status = 'enabled' THEN r.filter_id END) AS filter_ids,
       COUNT(DISTINCT CASE WHEN p.status = 'published' THEN p.id END) AS product_count
     FROM categories c
     LEFT JOIN image_assets a ON a.id = c.image_asset_id
     LEFT JOIN category_filter_relations r ON r.category_id = c.id
     LEFT JOIN category_filters f ON f.id = r.filter_id AND f.channel_id = c.channel_id
     LEFT JOIN products p ON p.category_id = c.id AND p.channel_id = c.channel_id
     WHERE c.channel_id = ?1 AND c.status = 'published'
     GROUP BY c.id, c.name, c.slug, a.object_key, c.sort_order, c.created_at
     ORDER BY c.sort_order ASC, c.created_at ASC`,
  ).bind(channelId).all<CategoryRow>();
  return result.results.map((row) => mapCategory(row, baseUrl));
}

export async function loadPublicCategory(
  channelId: string,
  categorySlug: string,
  baseUrl: string,
): Promise<PublicCategory | null> {
  const row = await env.DB.prepare(
    `SELECT
       c.id,
       c.name,
       c.slug,
       a.object_key,
       GROUP_CONCAT(DISTINCT CASE WHEN f.status = 'enabled' THEN r.filter_id END) AS filter_ids,
       COUNT(DISTINCT CASE WHEN p.status = 'published' THEN p.id END) AS product_count
     FROM categories c
     LEFT JOIN image_assets a ON a.id = c.image_asset_id
     LEFT JOIN category_filter_relations r ON r.category_id = c.id
     LEFT JOIN category_filters f ON f.id = r.filter_id AND f.channel_id = c.channel_id
     LEFT JOIN products p ON p.category_id = c.id AND p.channel_id = c.channel_id
     WHERE c.channel_id = ?1 AND c.slug = ?2 AND c.status = 'published'
     GROUP BY c.id, c.name, c.slug, a.object_key`,
  ).bind(channelId, categorySlug).first<CategoryRow>();
  return row ? mapCategory(row, baseUrl) : null;
}

export async function loadPublicProducts(input: {
  channelId: string;
  baseUrl: string;
  page?: number;
  categoryId?: string | null;
  query?: string;
}): Promise<PublicProductPage> {
  const page = Number.isSafeInteger(input.page) && (input.page ?? 0) > 0 ? input.page ?? 1 : 1;
  const offset = (page - 1) * PUBLIC_PRODUCT_PAGE_SIZE;
  const categoryId = input.categoryId ?? "";
  const query = (input.query ?? "").trim().slice(0, 100);
  const pattern = `%${query}%`;

  const result = await env.DB.prepare(
    `SELECT
       p.id,
       p.title,
       p.slug,
       cover.object_key,
       p.tags,
       p.featured
     FROM products p
     LEFT JOIN image_assets cover ON cover.id = p.cover_asset_id
     LEFT JOIN categories c ON c.id = p.category_id AND c.channel_id = p.channel_id
     WHERE p.channel_id = ?1
       AND p.status = 'published'
       AND (?2 = '' OR p.category_id = ?2)
       AND (?3 = '' OR p.title LIKE ?4 OR p.tags LIKE ?4)
       AND (p.category_id IS NULL OR c.status = 'published')
     ORDER BY p.featured DESC, p.sort_order ASC, p.created_at DESC
     LIMIT ?5 OFFSET ?6`,
  ).bind(
    input.channelId,
    categoryId,
    query,
    pattern,
    PUBLIC_PRODUCT_PAGE_SIZE + 1,
    offset,
  ).all<ProductCardRow>();

  return {
    products: result.results.slice(0, PUBLIC_PRODUCT_PAGE_SIZE).map((row) => mapProduct(row, input.baseUrl)),
    page,
    hasMore: result.results.length > PUBLIC_PRODUCT_PAGE_SIZE,
  };
}

export async function loadPublicProductDetail(
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
       CASE WHEN EXISTS (
         SELECT 1
         FROM conversion_groups g
         INNER JOIN conversion_resources r
           ON r.group_id = g.id AND r.status = 'enabled'
         WHERE g.id = p.conversion_group_id
           AND g.channel_id = p.channel_id
           AND g.status = 'enabled'
       ) THEN 1 ELSE 0 END AS has_conversion
     FROM products p
     INNER JOIN channels c ON c.id = p.channel_id AND c.status = 'published'
     LEFT JOIN categories category
       ON category.id = p.category_id
      AND category.channel_id = p.channel_id
      AND category.status = 'published'
     LEFT JOIN image_assets cover ON cover.id = p.cover_asset_id
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
    ...mapProduct(row, baseUrl),
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

export async function searchPublicCatalog(
  channelId: string,
  query: string,
  baseUrl: string,
): Promise<PublicSearchResults> {
  const normalized = query.trim().slice(0, 100);
  if (!normalized) return { categories: [], products: [] };
  const pattern = `%${normalized}%`;

  const [categories, products] = await Promise.all([
    env.DB.prepare(
      `SELECT
         c.id,
         c.name,
         c.slug,
         a.object_key,
         GROUP_CONCAT(DISTINCT CASE WHEN f.status = 'enabled' THEN r.filter_id END) AS filter_ids,
         COUNT(DISTINCT CASE WHEN p.status = 'published' THEN p.id END) AS product_count
       FROM categories c
       LEFT JOIN image_assets a ON a.id = c.image_asset_id
       LEFT JOIN category_filter_relations r ON r.category_id = c.id
       LEFT JOIN category_filters f ON f.id = r.filter_id AND f.channel_id = c.channel_id
       LEFT JOIN products p ON p.category_id = c.id AND p.channel_id = c.channel_id
       WHERE c.channel_id = ?1
         AND c.status = 'published'
         AND c.name LIKE ?2
       GROUP BY c.id, c.name, c.slug, a.object_key, c.sort_order, c.created_at
       ORDER BY c.sort_order ASC, c.created_at ASC
       LIMIT 20`,
    ).bind(channelId, pattern).all<CategoryRow>(),
    env.DB.prepare(
      `SELECT
         p.id,
         p.title,
         p.slug,
         cover.object_key,
         p.tags,
         p.featured
       FROM products p
       LEFT JOIN image_assets cover ON cover.id = p.cover_asset_id
       LEFT JOIN categories c ON c.id = p.category_id AND c.channel_id = p.channel_id
       WHERE p.channel_id = ?1
         AND p.status = 'published'
         AND (p.title LIKE ?2 OR p.tags LIKE ?2)
         AND (p.category_id IS NULL OR c.status = 'published')
       ORDER BY p.featured DESC, p.sort_order ASC, p.created_at DESC
       LIMIT 40`,
    ).bind(channelId, pattern).all<ProductCardRow>(),
  ]);

  return {
    categories: categories.results.map((row) => mapCategory(row, baseUrl)),
    products: products.results.map((row) => mapProduct(row, baseUrl)),
  };
}

export async function loadPublicSitemapEntries(): Promise<{
  channels: Array<{ slug: string; updatedAt: string }>;
  categories: Array<{ channelSlug: string; slug: string; updatedAt: string }>;
  products: Array<{ channelSlug: string; slug: string; updatedAt: string }>;
}> {
  const [channels, categories, products] = await Promise.all([
    env.DB.prepare(
      `SELECT slug, updated_at AS updatedAt
       FROM channels WHERE status = 'published'`,
    ).all<{ slug: string; updatedAt: string }>(),
    env.DB.prepare(
      `SELECT ch.slug AS channelSlug, c.slug, c.updated_at AS updatedAt
       FROM categories c
       INNER JOIN channels ch ON ch.id = c.channel_id AND ch.status = 'published'
       WHERE c.status = 'published'`,
    ).all<{ channelSlug: string; slug: string; updatedAt: string }>(),
    env.DB.prepare(
      `SELECT ch.slug AS channelSlug, p.slug, p.updated_at AS updatedAt
       FROM products p
       INNER JOIN channels ch ON ch.id = p.channel_id AND ch.status = 'published'
       LEFT JOIN categories c ON c.id = p.category_id AND c.channel_id = p.channel_id
       WHERE p.status = 'published'
         AND (p.category_id IS NULL OR c.status = 'published')`,
    ).all<{ channelSlug: string; slug: string; updatedAt: string }>(),
  ]);

  return {
    channels: channels.results,
    categories: categories.results,
    products: products.results,
  };
}
