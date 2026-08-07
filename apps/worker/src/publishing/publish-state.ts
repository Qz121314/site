import { createAuditLogStatement } from '../audit/write-audit-log';
import {
  listEnabledPublicProductTags,
  listProductTagsByProductIds,
} from '../products/product-tags';

const CURRENT_KEY = 'public/current.json';
const POINTER_CACHE = 'public, max-age=30, must-revalidate';

export type StorefrontPointer = {
  schemaVersion: 1;
  contentVersion: string;
  manifestKey: string;
  sourceRevision: string;
  publishedAt: string;
};

export type PublishVersionRecord = {
  contentVersion: string;
  publishJobId: string;
  manifestKey: string;
  sourceRevision: string;
  stateRevision: string | null;
  objectCount: number;
  totalBytes: number;
  isCurrent: boolean;
  publishedAt: string;
};

type SiteRow = {
  site_name: string;
  location_label: string;
  media_base_url: string | null;
  logo_object_key: string | null;
  home_section_limit: number;
  show_hot: number;
  show_latest: number;
  show_more: number;
  show_messages: number;
  show_faq: number;
  ga4_measurement_id: string | null;
  facebook_pixel_id: string | null;
  affiliate_detection_enabled: number;
  affiliate_platform: string | null;
  affiliate_detection_config_json: string | null;
};

type CustomerServiceRow = {
  is_enabled: number;
  provider: string | null;
  endpoint_url: string | null;
  project_id: string | null;
  config_json: string | null;
};

type SectionRow = {
  id: string;
  slug: string;
  name: string;
  icon_type: 'icon' | 'asset';
  icon_value: string | null;
  icon_object_key: string | null;
  sort_order: number;
};

type CategoryRow = {
  id: string;
  section_id: string;
  name: string;
  sort_order: number;
};

type ProductRow = {
  id: string;
  section_id: string;
  section_slug: string;
  section_name: string;
  slug: string;
  service_mode: 'online' | 'offline';
  title: string;
  body: string;
  address: string | null;
  category_id: string | null;
  category_name: string | null;
  conversion_mode: 'customer_service' | 'link' | null;
  button_label: string | null;
  effective_cover_object_key: string | null;
  is_featured: number;
  featured_order: number;
  sort_order: number;
  published_at: string | null;
};

type ProductMediaRow = {
  product_id: string;
  id: string;
  object_key: string;
  width: number | null;
  height: number | null;
  sort_order: number;
  alt_text: string | null;
};

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
};

type PublishVersionRow = {
  content_version: string;
  publish_job_id: string;
  manifest_key: string;
  source_revision: string;
  state_revision: string | null;
  object_count: number;
  total_bytes: number;
  is_current: number;
  published_at: string;
};

export class PublishStateError extends Error {
  readonly code: string;
  readonly status: 404 | 409;

  constructor(code: string, message: string, status: 404 | 409 = 409) {
    super(message);
    this.name = 'PublishStateError';
    this.code = code;
    this.status = status;
  }
}

function parseOptionalJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function buildPublicUrl(baseUrl: string | null, objectKey: string | null): string | null {
  return baseUrl && objectKey ? `${baseUrl}/${objectKey}` : null;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function mapPublishVersion(row: PublishVersionRow): PublishVersionRecord {
  return {
    contentVersion: row.content_version,
    publishJobId: row.publish_job_id,
    manifestKey: row.manifest_key,
    sourceRevision: row.source_revision,
    stateRevision: row.state_revision,
    objectCount: row.object_count,
    totalBytes: row.total_bytes,
    isCurrent: row.is_current === 1,
    publishedAt: row.published_at,
  };
}

export async function readStorefrontPointer(
  bucket: R2Bucket,
): Promise<{ pointer: StorefrontPointer | null; body: string | null }> {
  const object = await bucket.get(CURRENT_KEY);
  if (!object) return { pointer: null, body: null };
  const body = await object.text();
  try {
    const value = JSON.parse(body) as Partial<StorefrontPointer>;
    if (
      value.schemaVersion === 1 &&
      typeof value.contentVersion === 'string' &&
      typeof value.manifestKey === 'string' &&
      typeof value.sourceRevision === 'string' &&
      typeof value.publishedAt === 'string'
    ) {
      return { pointer: value as StorefrontPointer, body };
    }
  } catch {
    // A malformed pointer is treated as absent and can be repaired by the next publish.
  }
  return { pointer: null, body };
}

export async function listPublishVersions(db: D1Database): Promise<PublishVersionRecord[]> {
  const rows = (
    await db
      .prepare(
        `SELECT
           pv.content_version,
           pv.publish_job_id,
           pv.manifest_key,
           pj.source_revision,
           pv.state_revision,
           pv.object_count,
           pv.total_bytes,
           pv.is_current,
           pv.published_at
         FROM publish_versions pv
         JOIN publish_jobs pj ON pj.id = pv.publish_job_id
         WHERE pj.status = 'published'
         ORDER BY pv.published_at DESC, pv.content_version DESC
         LIMIT 3`,
      )
      .all<PublishVersionRow>()
  ).results;
  return rows.map(mapPublishVersion);
}

export async function setPublishVersionStateRevision(
  db: D1Database,
  contentVersion: string,
  stateRevision: string,
): Promise<void> {
  await db
    .prepare('UPDATE publish_versions SET state_revision = ? WHERE content_version = ?')
    .bind(stateRevision, contentVersion)
    .run();
}

export async function computeStorefrontStateRevision(db: D1Database): Promise<string> {
  const site = await db
    .prepare(
      `SELECT
         ss.site_name,
         ss.location_label,
         ss.media_base_url,
         ma.object_key AS logo_object_key,
         ss.home_section_limit,
         ss.show_hot,
         ss.show_latest,
         ss.show_more,
         ss.show_messages,
         ss.show_faq,
         ss.ga4_measurement_id,
         ss.facebook_pixel_id,
         ss.affiliate_detection_enabled,
         ss.affiliate_platform,
         ss.affiliate_detection_config_json
       FROM site_settings ss
       LEFT JOIN media_assets ma
         ON ma.id = ss.logo_asset_id
        AND ma.status = 'ready'
        AND ma.deleted_at IS NULL
       WHERE ss.id = 1`,
    )
    .first<SiteRow>();
  if (!site) {
    throw new PublishStateError('SITE_SETTINGS_MISSING', '站点设置不存在，无法判断前台发布状态。');
  }

  const customerService = await db
    .prepare(
      `SELECT is_enabled, provider, endpoint_url, project_id, config_json
       FROM customer_service_settings WHERE id = 1`,
    )
    .first<CustomerServiceRow>();

  const sections = (
    await db
      .prepare(
        `SELECT
           s.id, s.slug, s.name, s.icon_type, s.icon_value,
           ma.object_key AS icon_object_key, s.sort_order
         FROM sections s
         LEFT JOIN media_assets ma
           ON ma.id = s.icon_asset_id
          AND ma.status = 'ready'
          AND ma.deleted_at IS NULL
         WHERE s.deleted_at IS NULL AND s.is_enabled = 1
         ORDER BY s.sort_order ASC, s.name COLLATE NOCASE ASC`,
      )
      .all<SectionRow>()
  ).results;

  const categories = (
    await db
      .prepare(
        `SELECT c.id, c.section_id, c.name, c.sort_order
         FROM categories c
         JOIN sections s ON s.id = c.section_id
         WHERE c.deleted_at IS NULL
           AND c.is_enabled = 1
           AND s.deleted_at IS NULL
           AND s.is_enabled = 1
         ORDER BY c.section_id, c.sort_order ASC, c.name COLLATE NOCASE ASC`,
      )
      .all<CategoryRow>()
  ).results;

  const products = (
    await db
      .prepare(
        `SELECT
           p.id,
           p.section_id,
           s.slug AS section_slug,
           s.name AS section_name,
           p.slug,
           p.service_mode,
           p.title,
           p.body,
           p.address,
           p.category_id,
           c.name AS category_name,
           cg.mode AS conversion_mode,
           cg.button_label,
           cover.object_key AS effective_cover_object_key,
           p.is_featured,
           p.featured_order,
           p.sort_order,
           p.published_at
         FROM products p
         JOIN sections s
           ON s.id = p.section_id
          AND s.deleted_at IS NULL
          AND s.is_enabled = 1
         LEFT JOIN categories c ON c.id = p.category_id AND c.deleted_at IS NULL
         LEFT JOIN conversion_groups cg ON cg.id = p.conversion_group_id AND cg.deleted_at IS NULL
         LEFT JOIN media_assets cover ON cover.id = COALESCE(
           p.cover_asset_id,
           (SELECT pm.media_asset_id FROM product_media pm
             WHERE pm.product_id = p.id ORDER BY pm.sort_order ASC LIMIT 1)
         ) AND cover.status = 'ready' AND cover.deleted_at IS NULL
         WHERE p.deleted_at IS NULL AND p.status = 'published'
         ORDER BY p.section_id, p.sort_order ASC, p.updated_at DESC`,
      )
      .all<ProductRow>()
  ).results;

  const productMedia = (
    await db
      .prepare(
        `SELECT
           pm.product_id,
           ma.id,
           ma.object_key,
           ma.width,
           ma.height,
           pm.sort_order,
           pm.alt_text
         FROM product_media pm
         JOIN products p ON p.id = pm.product_id
         JOIN sections s ON s.id = p.section_id
         JOIN media_assets ma ON ma.id = pm.media_asset_id
         WHERE p.deleted_at IS NULL
           AND p.status = 'published'
           AND s.deleted_at IS NULL
           AND s.is_enabled = 1
           AND ma.deleted_at IS NULL
           AND ma.status = 'ready'
         ORDER BY pm.product_id, pm.sort_order ASC`,
      )
      .all<ProductMediaRow>()
  ).results;

  const faqs = (
    await db
      .prepare(
        `SELECT id, question, answer, sort_order
         FROM faqs
         WHERE deleted_at IS NULL AND is_enabled = 1
         ORDER BY sort_order ASC, created_at ASC`,
      )
      .all<FaqRow>()
  ).results;

  const [publicTags, tagsByProduct] = await Promise.all([
    listEnabledPublicProductTags(db),
    listProductTagsByProductIds(
      db,
      products.map((product) => product.id),
      true,
    ),
  ]);

  const mediaByProduct = new Map<string, ProductMediaRow[]>();
  for (const item of productMedia) {
    const current = mediaByProduct.get(item.product_id) ?? [];
    current.push(item);
    mediaByProduct.set(item.product_id, current);
  }

  const publicSections = sections.map((section) => ({
    id: section.id,
    slug: section.slug,
    name: section.name,
    icon:
      section.icon_type === 'asset'
        ? { type: 'image' as const, value: buildPublicUrl(site.media_base_url, section.icon_object_key) }
        : { type: 'icon' as const, value: section.icon_value },
    sortOrder: section.sort_order,
  }));

  const publicCategories = categories.map((category) => ({
    id: category.id,
    sectionId: category.section_id,
    name: category.name,
    sortOrder: category.sort_order,
  }));

  const publicProducts = products.map((product) => ({
    id: product.id,
    slug: product.slug,
    sectionId: product.section_id,
    sectionSlug: product.section_slug,
    sectionName: product.section_name,
    title: product.title,
    serviceMode: product.service_mode,
    address: product.address,
    category: { id: product.category_id, name: product.category_name },
    tags: (tagsByProduct.get(product.id) ?? []).map((tag) => ({
      id: tag.id,
      name: tag.name,
      sortOrder: tag.sortOrder,
    })),
    coverUrl: buildPublicUrl(site.media_base_url, product.effective_cover_object_key),
    isFeatured: product.is_featured === 1,
    featuredOrder: product.featured_order,
    publishedAt: product.published_at,
    sortOrder: product.sort_order,
    body: product.body,
    media: (mediaByProduct.get(product.id) ?? []).map((item) => ({
      id: item.id,
      url: buildPublicUrl(site.media_base_url, item.object_key),
      width: item.width,
      height: item.height,
      altText: item.alt_text,
      sortOrder: item.sort_order,
    })),
    cta: {
      label: product.button_label,
      mode: product.conversion_mode,
      path: `/go/${encodeURIComponent(product.id)}`,
    },
  }));

  const stateModel = {
    site: {
      name: site.site_name,
      locationLabel: site.location_label,
      mediaBaseUrl: site.media_base_url,
      logoUrl: buildPublicUrl(site.media_base_url, site.logo_object_key),
      homeSectionLimit: site.home_section_limit,
      navigation: {
        showHot: site.show_hot === 1,
        showLatest: site.show_latest === 1,
        showMore: site.show_more === 1,
        showMessages: site.show_messages === 1,
        showFaq: site.show_faq === 1,
      },
      analytics: {
        ga4MeasurementId: site.ga4_measurement_id,
        facebookPixelId: site.facebook_pixel_id,
      },
      affiliate: {
        enabled: site.affiliate_detection_enabled === 1,
        platform: site.affiliate_platform,
        config: parseOptionalJson(site.affiliate_detection_config_json),
      },
      customerService: customerService
        ? {
            enabled: customerService.is_enabled === 1,
            provider: customerService.provider,
            endpointUrl: customerService.endpoint_url,
            projectId: customerService.project_id,
            config: parseOptionalJson(customerService.config_json),
          }
        : null,
    },
    sections: publicSections,
    categories: publicCategories,
    tags: publicTags,
    products: publicProducts,
    faqs: faqs.map((faq) => ({
      id: faq.id,
      title: faq.question,
      body: faq.answer,
      sortOrder: faq.sort_order,
    })),
  };

  return sha256Hex(JSON.stringify(stateModel));
}

export async function rollbackStorefrontVersion(
  db: D1Database,
  bucket: R2Bucket,
  contentVersion: string,
  requestId: string,
): Promise<PublishVersionRecord> {
  const row = await db
    .prepare(
      `SELECT
         pv.content_version,
         pv.publish_job_id,
         pv.manifest_key,
         pj.source_revision,
         pv.state_revision,
         pv.object_count,
         pv.total_bytes,
         pv.is_current,
         pv.published_at
       FROM publish_versions pv
       JOIN publish_jobs pj ON pj.id = pv.publish_job_id
       WHERE pv.content_version = ? AND pj.status = 'published'`,
    )
    .bind(contentVersion)
    .first<PublishVersionRow>();
  if (!row) {
    throw new PublishStateError('PUBLISH_VERSION_NOT_FOUND', '该前台版本已不存在。', 404);
  }

  const target = mapPublishVersion(row);
  if (target.isCurrent) return target;
  if (!(await bucket.head(target.manifestKey))) {
    throw new PublishStateError('PUBLISH_VERSION_OBJECTS_MISSING', '该版本的 R2 快照已不完整，不能回退。');
  }

  const previous = await readStorefrontPointer(bucket);
  const pointer: StorefrontPointer = {
    schemaVersion: 1,
    contentVersion: target.contentVersion,
    manifestKey: target.manifestKey,
    sourceRevision: target.sourceRevision,
    publishedAt: target.publishedAt,
  };

  await bucket.put(CURRENT_KEY, JSON.stringify(pointer), {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: POINTER_CACHE },
  });

  try {
    await db.batch([
      db.prepare('UPDATE publish_versions SET is_current = 0 WHERE is_current = 1'),
      db.prepare('UPDATE publish_versions SET is_current = 1 WHERE content_version = ?').bind(target.contentVersion),
      createAuditLogStatement(db, {
        action: 'storefront.rolled_back',
        entityType: 'publish_version',
        entityId: target.contentVersion,
        requestId,
        metadata: {
          previousContentVersion: previous.pointer?.contentVersion ?? null,
          targetContentVersion: target.contentVersion,
        },
        createdAt: new Date().toISOString(),
      }),
    ]);
  } catch (error) {
    if (previous.body !== null) {
      await bucket.put(CURRENT_KEY, previous.body, {
        httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: POINTER_CACHE },
      });
    } else {
      await bucket.delete(CURRENT_KEY);
    }
    throw error;
  }

  return { ...target, isCurrent: true };
}
