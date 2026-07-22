import { env } from "cloudflare:workers";
import { buildPublicImageUrl } from "@/lib/images/url";

export const PUBLIC_PRODUCT_PAGE_SIZE = 20;

export type PublicChannelNavItem = {
  id: string;
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
  privacyContent: string;
  disclaimerContent: string;
  defaultChannelSlug: string | null;
  channels: PublicChannelNavItem[];
};

export type PublicChannel = PublicChannelNavItem;

export type PublicHeroAdvertisement = {
  id: string;
  imageUrl: string;
  width: number | null;
  height: number | null;
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
  filterIds: string[];
};

export type PublicProductCard = {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
  tags: string[];
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

type SiteShellRow = {
  site_name: string;
  site_description: string;
  r2_public_base_url: string;
  ga4_id: string;
  meta_pixel_id: string;
  adult_gate_enabled: number;
  logo_object_key: string | null;
  favicon_object_key: string | null;
  default_channel_slug: string | null;
  channel_id: string | null;
  channel_name: string | null;
  channel_slug: string | null;
  channel_icon: string | null;
};

type LegalRow = {
  privacy_content: string;
  disclaimer_content: string;
};

type HeroRow = {
  id: string;
  object_key: string;
  width: number | null;
  height: number | null;
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
  filter_ids: string | null;
};

type ProductCardRow = {
  id: string;
  title: string;
  slug: string;
  object_key: string | null;
  cover_width: number | null;
  cover_height: number | null;
  tags: string;
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

function truncateUtf8(value: string, maximumBytes: number): string {
  const encoder = new TextEncoder();
  let output = "";
  let bytes = 0;
  for (const character of value) {
    const length = encoder.encode(character).byteLength;
    if (bytes + length > maximumBytes) break;
    output += character;
    bytes += length;
  }
  return output;
}

function mapProduct(row: ProductCardRow, baseUrl: string): PublicProductCard {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    coverUrl: row.object_key ? buildPublicImageUrl(baseUrl, row.object_key) : null,
    coverWidth: row.object_key ? Number(row.cover_width) || null : null,
    coverHeight: row.object_key ? Number(row.cover_height) || null : null,
    tags: parseTags(row.tags),
  };
}

function mapCategory(row: CategoryRow): PublicCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    filterIds: row.filter_ids ? row.filter_ids.split(",").filter(Boolean) : [],
  };
}

const SITE_SHELL_CACHE_TTL_MS = 60_000;
const siteShellCache = new Map<boolean, { value: PublicSiteShell; expiresAt: number }>();
const pendingSiteShellReads = new Map<boolean, Promise<PublicSiteShell>>();

function defaultSiteShell(): PublicSiteShell {
  return {
    siteName: "Site",
    siteDescription: "Visual recommendations, updated in real time.",
    logoUrl: null,
    faviconUrl: null,
    r2PublicBaseUrl: "",
    ga4Id: "",
    metaPixelId: "",
    adultGateEnabled: false,
    privacyContent: "",
    disclaimerContent: "",
    defaultChannelSlug: null,
    channels: [],
  };
}

export async function loadPublicSiteShell(
  options: { includeLegalContent?: boolean } = {},
): Promise<PublicSiteShell> {
  const includeLegalContent = options.includeLegalContent === true;
  const cached = siteShellCache.get(includeLegalContent);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  const pending = pendingSiteShellReads.get(includeLegalContent);
  if (pending) return pending;

  const read = (async () => {
    try {
      const shellPromise = env.DB.prepare(
        `SELECT
         s.site_name,
         s.site_description,
         s.r2_public_base_url,
         s.ga4_id,
         s.meta_pixel_id,
         s.adult_gate_enabled,
         logo.object_key AS logo_object_key,
         favicon.object_key AS favicon_object_key,
         default_channel.slug AS default_channel_slug,
         channel.id AS channel_id,
         channel.name AS channel_name,
         channel.slug AS channel_slug,
         channel.icon AS channel_icon
       FROM site_settings s
       LEFT JOIN image_assets logo ON logo.id = s.logo_asset_id
       LEFT JOIN image_assets favicon ON favicon.id = s.favicon_asset_id
       LEFT JOIN channels default_channel
         ON default_channel.id = s.default_channel_id
        AND default_channel.status = 'published'
       LEFT JOIN channels channel ON channel.status = 'published'
       WHERE s.id = 1
         ORDER BY channel.sort_order ASC, channel.created_at ASC`,
      ).all<SiteShellRow>();
      const legalPromise = includeLegalContent
        ? env.DB.prepare(
            `SELECT privacy_content, disclaimer_content
             FROM site_settings WHERE id = 1`,
          ).first<LegalRow>()
        : Promise.resolve(null);

      const [shellResult, legal] = await Promise.all([shellPromise, legalPromise]);
      const first = shellResult.results[0];
      if (!first) return defaultSiteShell();

      const baseUrl = first.r2_public_base_url ?? "";
      const value: PublicSiteShell = {
        siteName: first.site_name,
        siteDescription: first.site_description,
        logoUrl: first.logo_object_key ? buildPublicImageUrl(baseUrl, first.logo_object_key) : null,
        faviconUrl: first.favicon_object_key ? buildPublicImageUrl(baseUrl, first.favicon_object_key) : null,
        r2PublicBaseUrl: baseUrl,
        ga4Id: first.ga4_id ?? "",
        metaPixelId: first.meta_pixel_id ?? "",
        adultGateEnabled: first.adult_gate_enabled === 1,
        privacyContent: legal?.privacy_content ?? "",
        disclaimerContent: legal?.disclaimer_content ?? "",
        defaultChannelSlug: first.default_channel_slug,
        channels: shellResult.results.flatMap((row) =>
          row.channel_id && row.channel_name && row.channel_slug
            ? [{
                id: row.channel_id,
                name: row.channel_name,
                slug: row.channel_slug,
                icon: row.channel_icon ?? "",
              }]
            : [],
        ),
      };
      siteShellCache.set(includeLegalContent, {
        value,
        expiresAt: Date.now() + SITE_SHELL_CACHE_TTL_MS,
      });
      return value;
    } catch (error) {
      console.error(JSON.stringify({ event: "public_site_shell_read_failed", error: String(error) }));
      return defaultSiteShell();
    } finally {
      pendingSiteShellReads.delete(includeLegalContent);
    }
  })();

  pendingSiteShellReads.set(includeLegalContent, read);
  return read;
}

export function findPublicChannel(site: PublicSiteShell, channelSlug: string): PublicChannel | null {
  return site.channels.find((channel) => channel.slug === channelSlug) ?? null;
}

export async function loadPublicHeroAdvertisements(
  channelId: string,
  baseUrl: string,
): Promise<PublicHeroAdvertisement[]> {
  const result = await env.DB.prepare(
    `SELECT ad.id, a.object_key, a.width, a.height, ad.target_url, ad.open_mode
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
      ? [{
          id: row.id,
          imageUrl,
          width: Number(row.width) || null,
          height: Number(row.height) || null,
          targetUrl: row.target_url,
          openMode: row.open_mode,
        }]
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

const categoryAggregateCtes = `
  WITH filter_usage AS (
    SELECT relation.category_id, GROUP_CONCAT(relation.filter_id) AS filter_ids
    FROM category_filter_relations relation
    INNER JOIN category_filters filter
      ON filter.id = relation.filter_id
     AND filter.status = 'enabled'
    WHERE filter.channel_id = ?1
    GROUP BY relation.category_id
  )
`;

export async function loadPublicCategories(
  channelId: string,
): Promise<PublicCategory[]> {
  const result = await env.DB.prepare(
    `${categoryAggregateCtes}
     SELECT
       category.id,
       category.name,
       category.slug,
       filter_usage.filter_ids
     FROM categories category
     LEFT JOIN filter_usage ON filter_usage.category_id = category.id
     WHERE category.channel_id = ?1
       AND category.status = 'published'
       AND EXISTS (
         SELECT 1
         FROM products product
         WHERE product.channel_id = category.channel_id
           AND product.category_id = category.id
           AND product.status = 'published'
         LIMIT 1
       )
     ORDER BY category.sort_order ASC, category.created_at ASC`,
  ).bind(channelId).all<CategoryRow>();
  return result.results.map(mapCategory);
}

export async function loadPublicCategory(
  channelId: string,
  categorySlug: string,
): Promise<PublicCategory | null> {
  const row = await env.DB.prepare(
    `${categoryAggregateCtes}
     SELECT
       category.id,
       category.name,
       category.slug,
       filter_usage.filter_ids
     FROM categories category
     LEFT JOIN filter_usage ON filter_usage.category_id = category.id
     WHERE category.channel_id = ?1
       AND category.slug = ?2
       AND category.status = 'published'`,
  ).bind(channelId, categorySlug).first<CategoryRow>();
  return row ? mapCategory(row) : null;
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
  const query = truncateUtf8((input.query ?? "").trim(), 48);
  const bindings: Array<string | number> = [input.channelId];
  const conditions = ["p.channel_id = ?1", "p.status = 'published'"];

  if (categoryId) {
    bindings.push(categoryId);
    conditions.push(`p.category_id = ?${bindings.length}`);
  }
  if (query) {
    bindings.push(`%${query}%`);
    conditions.push(`(p.title LIKE ?${bindings.length} OR p.tags LIKE ?${bindings.length})`);
  }
  bindings.push(PUBLIC_PRODUCT_PAGE_SIZE + 1, offset);
  const limitParameter = bindings.length - 1;
  const offsetParameter = bindings.length;

  const result = await env.DB.prepare(
    `SELECT
       p.id,
       p.title,
       p.slug,
       COALESCE(cover.thumbnail_object_key, cover.object_key) AS object_key,
       CASE WHEN cover.thumbnail_object_key IS NOT NULL THEN cover.thumbnail_width ELSE cover.width END AS cover_width,
       CASE WHEN cover.thumbnail_object_key IS NOT NULL THEN cover.thumbnail_height ELSE cover.height END AS cover_height,
       p.tags
     FROM products p
     LEFT JOIN image_assets cover ON cover.id = p.cover_asset_id
     LEFT JOIN categories category
       ON category.id = p.category_id
      AND category.channel_id = p.channel_id
     WHERE ${conditions.join(" AND ")}
       AND (p.category_id IS NULL OR category.status = 'published')
     ORDER BY p.sort_order ASC, p.created_at DESC
     LIMIT ?${limitParameter} OFFSET ?${offsetParameter}`,
  ).bind(...bindings).all<ProductCardRow>();

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
       channel.name AS channel_name,
       channel.slug AS channel_slug,
       category.name AS category_name,
       category.slug AS category_slug,
       p.title,
       p.slug,
       cover.object_key,
       cover.width AS cover_width,
       cover.height AS cover_height,
       p.tags,
       p.body_html,
       p.cta_label,
       EXISTS(
         SELECT 1
         FROM conversion_groups conversion_group
         INNER JOIN conversion_resources resource
           ON resource.group_id = conversion_group.id
          AND resource.status = 'enabled'
         WHERE conversion_group.id = p.conversion_group_id
           AND conversion_group.channel_id = p.channel_id
           AND conversion_group.status = 'enabled'
         LIMIT 1
       ) AS has_conversion
     FROM products p
     INNER JOIN channels channel
       ON channel.id = p.channel_id
      AND channel.status = 'published'
     LEFT JOIN categories category
       ON category.id = p.category_id
      AND category.channel_id = p.channel_id
      AND category.status = 'published'
     LEFT JOIN image_assets cover ON cover.id = p.cover_asset_id
     WHERE channel.slug = ?1
       AND p.slug = ?2
       AND p.status = 'published'
       AND (p.category_id IS NULL OR category.id IS NOT NULL)`,
  ).bind(channelSlug, productSlug).first<ProductDetailRow>();
  if (!row) return null;

  const galleryResult = await env.DB.prepare(
    `SELECT
       image.id,
       image.object_key,
       image.original_name,
       image.width,
       image.height
     FROM product_images relation
     INNER JOIN image_assets image ON image.id = relation.image_asset_id
     WHERE relation.product_id = ?1
     ORDER BY relation.sort_order ASC, image.created_at ASC`,
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
    hasConversion: Boolean(row.has_conversion),
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
  const normalized = truncateUtf8(query.trim(), 48);
  if (!normalized) return { categories: [], products: [] };
  const pattern = `%${normalized}%`;

  const [categories, products] = await Promise.all([
    env.DB.prepare(
      `${categoryAggregateCtes}
       SELECT
         category.id,
         category.name,
         category.slug,
         filter_usage.filter_ids
       FROM categories category
       LEFT JOIN filter_usage ON filter_usage.category_id = category.id
       WHERE category.channel_id = ?1
         AND category.status = 'published'
         AND category.name LIKE ?2
         AND EXISTS (
           SELECT 1
           FROM products product
           WHERE product.channel_id = category.channel_id
             AND product.category_id = category.id
             AND product.status = 'published'
           LIMIT 1
         )
       ORDER BY category.sort_order ASC, category.created_at ASC
       LIMIT 20`,
    ).bind(channelId, pattern).all<CategoryRow>(),
    env.DB.prepare(
      `SELECT
         p.id,
         p.title,
         p.slug,
         COALESCE(cover.thumbnail_object_key, cover.object_key) AS object_key,
         CASE WHEN cover.thumbnail_object_key IS NOT NULL THEN cover.thumbnail_width ELSE cover.width END AS cover_width,
         CASE WHEN cover.thumbnail_object_key IS NOT NULL THEN cover.thumbnail_height ELSE cover.height END AS cover_height,
         p.tags
       FROM products p
       LEFT JOIN image_assets cover ON cover.id = p.cover_asset_id
       LEFT JOIN categories category
         ON category.id = p.category_id
        AND category.channel_id = p.channel_id
       WHERE p.channel_id = ?1
         AND p.status = 'published'
         AND (p.title LIKE ?2 OR p.tags LIKE ?2)
         AND (p.category_id IS NULL OR category.status = 'published')
       ORDER BY p.sort_order ASC, p.created_at DESC
       LIMIT 40`,
    ).bind(channelId, pattern).all<ProductCardRow>(),
  ]);

  return {
    categories: categories.results.map(mapCategory),
    products: products.results.map((row) => mapProduct(row, baseUrl)),
  };
}
