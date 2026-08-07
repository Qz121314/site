import { createAuditLogStatement } from '../audit/write-audit-log';

const CURRENT_KEY = 'public/current.json';
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
const POINTER_CACHE = 'public, max-age=30, must-revalidate';

export type PublishJobState = 'queued' | 'building' | 'published' | 'failed' | 'cancelled';

export type PublishStatus = {
  currentVersion: string | null;
  publishedAt: string | null;
  lastJob: {
    id: string;
    status: PublishJobState;
    contentVersion: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    requestedAt: string;
    completedAt: string | null;
  } | null;
};

export type PublishResult = {
  jobId: string;
  contentVersion: string;
  sourceRevision: string;
  publishedAt: string;
  objectCount: number;
  totalBytes: number;
};

export class PublicationError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 409) {
    super(message);
    this.name = 'PublicationError';
    this.code = code;
    this.status = status;
  }
}

type SiteRow = {
  site_name: string;
  location_label: string;
  media_base_url: string | null;
  logo_asset_id: string | null;
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
  updated_at: string;
};

type CustomerServiceRow = {
  is_enabled: number;
  provider: string | null;
  endpoint_url: string | null;
  project_id: string | null;
  config_json: string | null;
  updated_at: string;
};

type SectionRow = {
  id: string;
  slug: string;
  name: string;
  icon_type: 'icon' | 'asset';
  icon_value: string | null;
  icon_asset_id: string | null;
  icon_object_key: string | null;
  sort_order: number;
  updated_at: string;
};

type CategoryRow = {
  id: string;
  section_id: string;
  name: string;
  sort_order: number;
  updated_at: string;
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
  category_enabled: number | null;
  conversion_group_id: string | null;
  conversion_group_name: string | null;
  conversion_mode: 'customer_service' | 'link' | null;
  button_label: string | null;
  conversion_group_enabled: number | null;
  active_target_count: number;
  effective_cover_object_key: string | null;
  is_featured: number;
  featured_order: number;
  sort_order: number;
  published_at: string | null;
  updated_at: string;
};

type ProductMediaRow = {
  product_id: string;
  id: string;
  object_key: string;
  file_name: string;
  mime_type: string;
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
  created_at: string;
  updated_at: string;
};

type LatestJobRow = {
  id: string;
  status: PublishJobState;
  content_version: string | null;
  error_code: string | null;
  error_message: string | null;
  requested_at: string;
  completed_at: string | null;
};

type CurrentPointer = {
  schemaVersion: 1;
  contentVersion: string;
  manifestKey: string;
  sourceRevision: string;
  publishedAt: string;
};

type EncodedFile = {
  relativePath: string;
  key: string;
  body: string;
  byteSize: number;
  sha256: string;
};

function parseOptionalJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function buildPublicUrl(baseUrl: string, objectKey: string | null): string | null {
  return objectKey ? `${baseUrl}/${objectKey}` : null;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function encodeFile(prefix: string, relativePath: string, value: unknown): Promise<EncodedFile> {
  const body = JSON.stringify(value);
  return {
    relativePath,
    key: `${prefix}/${relativePath}`,
    body,
    byteSize: new TextEncoder().encode(body).byteLength,
    sha256: await sha256Hex(body),
  };
}

async function readCurrentPointer(bucket: R2Bucket): Promise<{ pointer: CurrentPointer | null; body: string | null }> {
  const object = await bucket.get(CURRENT_KEY);
  if (!object) return { pointer: null, body: null };
  const body = await object.text();
  try {
    const parsed = JSON.parse(body) as Partial<CurrentPointer>;
    if (
      parsed.schemaVersion === 1 &&
      typeof parsed.contentVersion === 'string' &&
      typeof parsed.manifestKey === 'string' &&
      typeof parsed.sourceRevision === 'string' &&
      typeof parsed.publishedAt === 'string'
    ) {
      return { pointer: parsed as CurrentPointer, body };
    }
  } catch {
    // Treat a malformed pointer as absent. A successful publish will replace it.
  }
  return { pointer: null, body };
}

async function loadSnapshotSource(db: D1Database) {
  const site = await db
    .prepare(
      `SELECT
         ss.site_name,
         ss.location_label,
         ss.media_base_url,
         ss.logo_asset_id,
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
         ss.affiliate_detection_config_json,
         ss.updated_at
       FROM site_settings ss
       LEFT JOIN media_assets ma
         ON ma.id = ss.logo_asset_id
        AND ma.status = 'ready'
        AND ma.deleted_at IS NULL
       WHERE ss.id = 1`,
    )
    .first<SiteRow>();

  if (!site) throw new PublicationError('SITE_SETTINGS_MISSING', '站点设置不存在，无法发布前台。');
  if (!site.media_base_url) {
    throw new PublicationError('MEDIA_DOMAIN_REQUIRED', '发布前台前必须先配置并测试 R2 自定义域名。');
  }
  if (site.logo_asset_id && !site.logo_object_key) {
    throw new PublicationError('SITE_LOGO_INVALID', '当前站点 Logo 已不可用，请重新设置后再发布。');
  }

  const customerService = await db
    .prepare(
      `SELECT is_enabled, provider, endpoint_url, project_id, config_json, updated_at
       FROM customer_service_settings WHERE id = 1`,
    )
    .first<CustomerServiceRow>();

  const sections = (
    await db
      .prepare(
        `SELECT
           s.id, s.slug, s.name, s.icon_type, s.icon_value, s.icon_asset_id,
           ma.object_key AS icon_object_key, s.sort_order, s.updated_at
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

  for (const section of sections) {
    if (section.icon_type === 'asset' && !section.icon_object_key) {
      throw new PublicationError(
        'SECTION_ICON_INVALID',
        `分区“${section.name}”的图片图标已不可用，请重新设置后再发布。`,
      );
    }
  }

  const categories = (
    await db
      .prepare(
        `SELECT c.id, c.section_id, c.name, c.sort_order, c.updated_at
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
           c.is_enabled AS category_enabled,
           p.conversion_group_id,
           cg.name AS conversion_group_name,
           cg.mode AS conversion_mode,
           cg.button_label,
           cg.is_enabled AS conversion_group_enabled,
           (SELECT COUNT(*) FROM conversion_targets ct
             WHERE ct.group_id = cg.id
               AND ct.deleted_at IS NULL
               AND ct.is_enabled = 1) AS active_target_count,
           cover.object_key AS effective_cover_object_key,
           p.is_featured,
           p.featured_order,
           p.sort_order,
           p.published_at,
           p.updated_at
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
           ma.file_name,
           ma.mime_type,
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
        `SELECT id, question, answer, sort_order, created_at, updated_at
         FROM faqs
         WHERE deleted_at IS NULL AND is_enabled = 1
         ORDER BY sort_order ASC, created_at ASC`,
      )
      .all<FaqRow>()
  ).results;

  const mediaByProduct = new Map<string, ProductMediaRow[]>();
  for (const item of productMedia) {
    const current = mediaByProduct.get(item.product_id) ?? [];
    current.push(item);
    mediaByProduct.set(item.product_id, current);
  }

  for (const product of products) {
    if (!product.category_id || !product.category_name || product.category_enabled !== 1) {
      throw new PublicationError(
        'PRODUCT_CATEGORY_INVALID',
        `产品“${product.title}”没有可用分类，无法发布前台。`,
      );
    }
    if (
      !product.conversion_group_id ||
      !product.conversion_group_name ||
      !product.conversion_mode ||
      !product.button_label ||
      product.conversion_group_enabled !== 1 ||
      product.active_target_count < 1
    ) {
      throw new PublicationError(
        'PRODUCT_CONVERSION_INVALID',
        `产品“${product.title}”没有可用的转化分组或启用入口，无法发布前台。`,
      );
    }
    if (product.service_mode === 'offline' && !product.address) {
      throw new PublicationError('PRODUCT_ADDRESS_REQUIRED', `产品“${product.title}”缺少服务地址。`);
    }
    if ((mediaByProduct.get(product.id) ?? []).length === 0 || !product.effective_cover_object_key) {
      throw new PublicationError('PRODUCT_MEDIA_INVALID', `产品“${product.title}”缺少可用图片。`);
    }
  }

  return { site, customerService, sections, categories, products, mediaByProduct, faqs };
}

function productSummary(product: ProductRow, mediaBaseUrl: string) {
  return {
    id: product.id,
    slug: product.slug,
    sectionId: product.section_id,
    sectionSlug: product.section_slug,
    sectionName: product.section_name,
    title: product.title,
    serviceMode: product.service_mode,
    address: product.address,
    category: { id: product.category_id, name: product.category_name },
    coverUrl: buildPublicUrl(mediaBaseUrl, product.effective_cover_object_key),
    isFeatured: product.is_featured === 1,
    publishedAt: product.published_at,
    sortOrder: product.sort_order,
  };
}

export async function getPublishStatus(db: D1Database, bucket: R2Bucket): Promise<PublishStatus> {
  const [pointerResult, latestJob] = await Promise.all([
    readCurrentPointer(bucket),
    db
      .prepare(
        `SELECT id, status, content_version, error_code, error_message, requested_at, completed_at
         FROM publish_jobs ORDER BY requested_at DESC LIMIT 1`,
      )
      .first<LatestJobRow>(),
  ]);

  return {
    currentVersion: pointerResult.pointer?.contentVersion ?? null,
    publishedAt: pointerResult.pointer?.publishedAt ?? null,
    lastJob: latestJob
      ? {
          id: latestJob.id,
          status: latestJob.status,
          contentVersion: latestJob.content_version,
          errorCode: latestJob.error_code,
          errorMessage: latestJob.error_message,
          requestedAt: latestJob.requested_at,
          completedAt: latestJob.completed_at,
        }
      : null,
  };
}

export async function publishSnapshot(
  db: D1Database,
  bucket: R2Bucket,
  requestId: string,
): Promise<PublishResult> {
  const now = new Date();
  const requestedAt = now.toISOString();
  const staleBefore = new Date(now.getTime() - 15 * 60_000).toISOString();
  const activeJob = await db
    .prepare(
      `SELECT id, requested_at FROM publish_jobs
       WHERE status IN ('queued', 'building')
       ORDER BY requested_at DESC LIMIT 1`,
    )
    .first<{ id: string; requested_at: string }>();

  if (activeJob && activeJob.requested_at >= staleBefore) {
    throw new PublicationError('PUBLISH_IN_PROGRESS', '已有前台发布任务正在执行，请稍后再试。', 409);
  }
  if (activeJob) {
    await db
      .prepare(
        `UPDATE publish_jobs SET status = 'cancelled', error_code = 'STALE_JOB',
          error_message = 'Stale publish job replaced by a new manual publish.', completed_at = ?
         WHERE id = ? AND status IN ('queued', 'building')`,
      )
      .bind(requestedAt, activeJob.id)
      .run();
  }

  const source = await loadSnapshotSource(db);
  const mediaBaseUrl = source.site.media_base_url as string;

  const publicSections = source.sections.map((section) => ({
    id: section.id,
    slug: section.slug,
    name: section.name,
    icon:
      section.icon_type === 'asset'
        ? { type: 'image' as const, value: buildPublicUrl(mediaBaseUrl, section.icon_object_key) }
        : { type: 'icon' as const, value: section.icon_value },
    sortOrder: section.sort_order,
  }));

  const publicCategories = source.categories.map((category) => ({
    id: category.id,
    sectionId: category.section_id,
    name: category.name,
    sortOrder: category.sort_order,
  }));

  const publicProducts = source.products.map((product) => {
    const media = (source.mediaByProduct.get(product.id) ?? []).map((item) => ({
      id: item.id,
      url: buildPublicUrl(mediaBaseUrl, item.object_key),
      width: item.width,
      height: item.height,
      altText: item.alt_text,
      sortOrder: item.sort_order,
    }));
    return {
      ...productSummary(product, mediaBaseUrl),
      body: product.body,
      media,
      cta: {
        label: product.button_label,
        mode: product.conversion_mode,
        path: `/go/${encodeURIComponent(product.id)}`,
      },
    };
  });

  const siteData = {
    name: source.site.site_name,
    locationLabel: source.site.location_label,
    mediaBaseUrl,
    logoUrl: buildPublicUrl(mediaBaseUrl, source.site.logo_object_key),
    navigation: {
      showHot: source.site.show_hot === 1,
      showLatest: source.site.show_latest === 1,
      showMore: source.site.show_more === 1,
      showMessages: source.site.show_messages === 1,
      showFaq: source.site.show_faq === 1,
    },
    analytics: {
      ga4MeasurementId: source.site.ga4_measurement_id,
      facebookPixelId: source.site.facebook_pixel_id,
    },
    affiliate: {
      enabled: source.site.affiliate_detection_enabled === 1,
      platform: source.site.affiliate_platform,
      config: parseOptionalJson(source.site.affiliate_detection_config_json),
    },
    customerService: source.customerService
      ? {
          enabled: source.customerService.is_enabled === 1,
          provider: source.customerService.provider,
          endpointUrl: source.customerService.endpoint_url,
          projectId: source.customerService.project_id,
          config: parseOptionalJson(source.customerService.config_json),
        }
      : null,
  };

  const sourceModel = {
    site: siteData,
    sections: publicSections,
    categories: publicCategories,
    products: publicProducts,
    faqs: source.faqs.map((faq) => ({ id: faq.id, title: faq.question, body: faq.answer })),
  };
  const sourceRevision = await sha256Hex(JSON.stringify(sourceModel));
  const publishedAt = new Date().toISOString();
  const versionStamp = publishedAt.replace(/[-:.TZ]/g, '');
  const contentVersion = `${versionStamp}-${sourceRevision.slice(0, 12)}-${crypto.randomUUID().slice(0, 8)}`;
  const prefix = `public/versions/${contentVersion}`;
  const jobId = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO publish_jobs (
         id, status, source_revision, requested_at, started_at
       ) VALUES (?, 'building', ?, ?, ?)`,
    )
    .bind(jobId, sourceRevision, requestedAt, publishedAt)
    .run();

  const { pointer: previousPointer, body: previousPointerBody } = await readCurrentPointer(bucket);
  let currentPointerWritten = false;

  try {
    const summaries = publicProducts.map((product) => ({
      id: product.id,
      slug: product.slug,
      sectionId: product.sectionId,
      sectionSlug: product.sectionSlug,
      sectionName: product.sectionName,
      title: product.title,
      serviceMode: product.serviceMode,
      address: product.address,
      category: product.category,
      coverUrl: product.coverUrl,
      isFeatured: product.isFeatured,
      publishedAt: product.publishedAt,
      sortOrder: product.sortOrder,
    }));

    const featuredProducts = [...summaries]
      .filter((product) => product.isFeatured)
      .sort((left, right) => {
        const leftRow = source.products.find((item) => item.id === left.id);
        const rightRow = source.products.find((item) => item.id === right.id);
        return (leftRow?.featured_order ?? 0) - (rightRow?.featured_order ?? 0);
      })
      .slice(0, 30);

    const latestProducts = [...summaries]
      .sort((left, right) => (right.publishedAt ?? '').localeCompare(left.publishedAt ?? ''))
      .slice(0, 30);

    const files: EncodedFile[] = [];
    files.push(
      await encodeFile(prefix, 'site.json', {
        schemaVersion: 1,
        contentVersion,
        publishedAt,
        site: siteData,
      }),
    );
    files.push(
      await encodeFile(prefix, 'home.json', {
        schemaVersion: 1,
        contentVersion,
        publishedAt,
        sections: publicSections.slice(0, source.site.home_section_limit),
        allSections: publicSections,
        featuredProducts,
        latestProducts,
      }),
    );
    files.push(
      await encodeFile(prefix, 'faq.json', {
        schemaVersion: 1,
        contentVersion,
        publishedAt,
        faqs: source.faqs.map((faq) => ({ id: faq.id, title: faq.question, body: faq.answer })),
      }),
    );

    for (const section of publicSections) {
      files.push(
        await encodeFile(prefix, `sections/${section.id}.json`, {
          schemaVersion: 1,
          contentVersion,
          publishedAt,
          section,
          categories: publicCategories.filter((category) => category.sectionId === section.id),
          products: summaries.filter((product) => product.sectionId === section.id),
        }),
      );
    }

    for (const product of publicProducts) {
      files.push(
        await encodeFile(prefix, `products/${product.id}.json`, {
          schemaVersion: 1,
          contentVersion,
          publishedAt,
          product,
        }),
      );
    }

    const manifestValue = {
      schemaVersion: 1,
      contentVersion,
      sourceRevision,
      publishedAt,
      counts: {
        sections: publicSections.length,
        categories: publicCategories.length,
        products: publicProducts.length,
        faqs: source.faqs.length,
      },
      files: files.map((file) => ({
        path: file.relativePath,
        key: file.key,
        sha256: file.sha256,
        byteSize: file.byteSize,
      })),
    };
    const manifest = await encodeFile(prefix, 'manifest.json', manifestValue);

    await Promise.all(
      [...files, manifest].map((file) =>
        bucket.put(file.key, file.body, {
          httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: IMMUTABLE_CACHE },
          customMetadata: { contentVersion, sourceRevision },
        }),
      ),
    );

    const objectCount = files.length + 1;
    const totalBytes = files.reduce((sum, file) => sum + file.byteSize, 0) + manifest.byteSize;

    await db
      .prepare(
        `INSERT INTO publish_versions (
           content_version, publish_job_id, manifest_key, manifest_sha256,
           object_count, total_bytes, is_current, published_at
         ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      )
      .bind(
        contentVersion,
        jobId,
        manifest.key,
        manifest.sha256,
        objectCount,
        totalBytes,
        publishedAt,
      )
      .run();

    const currentPointer: CurrentPointer = {
      schemaVersion: 1,
      contentVersion,
      manifestKey: manifest.key,
      sourceRevision,
      publishedAt,
    };
    await bucket.put(CURRENT_KEY, JSON.stringify(currentPointer), {
      httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: POINTER_CACHE },
    });
    currentPointerWritten = true;

    try {
      await db.batch([
        db.prepare('UPDATE publish_versions SET is_current = 0 WHERE is_current = 1'),
        db.prepare('UPDATE publish_versions SET is_current = 1 WHERE content_version = ?').bind(contentVersion),
        db
          .prepare(
            `UPDATE publish_jobs
             SET status = 'published', content_version = ?, previous_content_version = ?,
                 completed_at = ?, error_code = NULL, error_message = NULL
             WHERE id = ?`,
          )
          .bind(contentVersion, previousPointer?.contentVersion ?? null, publishedAt, jobId),
        createAuditLogStatement(db, {
          action: 'storefront.published',
          entityType: 'publish_version',
          entityId: contentVersion,
          requestId,
          metadata: {
            sourceRevision,
            previousContentVersion: previousPointer?.contentVersion ?? null,
            objectCount,
            totalBytes,
          },
          createdAt: publishedAt,
        }),
      ]);
    } catch (error) {
      if (previousPointerBody !== null) {
        await bucket.put(CURRENT_KEY, previousPointerBody, {
          httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: POINTER_CACHE },
        });
      } else {
        await bucket.delete(CURRENT_KEY);
      }
      currentPointerWritten = false;
      throw error;
    }

    return { jobId, contentVersion, sourceRevision, publishedAt, objectCount, totalBytes };
  } catch (error) {
    if (currentPointerWritten) {
      try {
        if (previousPointerBody !== null) {
          await bucket.put(CURRENT_KEY, previousPointerBody, {
            httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: POINTER_CACHE },
          });
        } else {
          await bucket.delete(CURRENT_KEY);
        }
      } catch {
        // Best-effort pointer rollback. The original publication error is more actionable.
      }
    }
    const message = error instanceof Error ? error.message.slice(0, 1000) : '未知发布错误';
    try {
      await db
        .prepare(
          `UPDATE publish_jobs
           SET status = 'failed', error_code = 'PUBLISH_FAILED', error_message = ?, completed_at = ?
           WHERE id = ? AND status <> 'published'`,
        )
        .bind(message, new Date().toISOString(), jobId)
        .run();
    } catch {
      // Do not hide the R2/publication failure with a secondary bookkeeping failure.
    }
    throw error;
  }
}
