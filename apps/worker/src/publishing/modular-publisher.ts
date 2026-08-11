import { createAuditLogStatement } from '../audit/write-audit-log';
import {
  listEnabledPublicProductTags,
  listProductTagsByProductIds,
  type BoundProductTag,
  type PublicProductTag,
} from '../products/product-tags';

const CURRENT_KEY = 'public/current.json';
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
const POINTER_CACHE = 'public, max-age=30, must-revalidate';
const RETAINED_VERSION_COUNT = 3;
const R2_DELETE_BATCH_SIZE = 1000;
const SECTION_PREFIX = 'section:';

export type PublishModuleKind = 'site' | 'sections-index' | 'faq' | 'section';
export type PublishModuleKey = string;
export type PublishModuleJobState = 'building' | 'published' | 'failed' | 'cancelled';

export type ModuleReference = {
  contentVersion: string;
  manifestKey: string;
  sourceRevision: string;
  publishedAt: string;
};

export type ModularStorefrontPointer = {
  schemaVersion: 2;
  contentVersion: string;
  publishedAt: string;
  site: ModuleReference;
  sectionsIndex: ModuleReference;
  faq: ModuleReference;
  sections: Record<string, ModuleReference>;
};

export type PublishModuleVersion = {
  moduleKey: string;
  contentVersion: string;
  sourceRevision: string;
  publishedAt: string;
  isCurrent: boolean;
  objectCount: number;
  totalBytes: number;
};

export type PublishModuleStatus = {
  key: string;
  kind: PublishModuleKind;
  sectionId: string | null;
  label: string;
  currentVersion: string | null;
  publishedAt: string | null;
  isCurrent: boolean;
  versions: PublishModuleVersion[];
  lastJob: {
    id: string;
    status: PublishModuleJobState;
    contentVersion: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    requestedAt: string;
    completedAt: string | null;
  } | null;
};

export type ModularPublishStatus = {
  pointerVersion: string | null;
  publishedAt: string | null;
  isCurrent: boolean;
  dirtyCount: number;
  bootstrapRequired: boolean;
  legacyPointerDetected: boolean;
  mediaBaseUrl: string | null;
  modules: PublishModuleStatus[];
};

export type PublishModuleResult = {
  moduleKey: string;
  label: string;
  contentVersion: string | null;
  sourceRevision: string;
  publishedAt: string | null;
  objectCount: number;
  totalBytes: number;
  unchanged: boolean;
};

export type ModularPublishResult = {
  pointerVersion: string;
  publishedAt: string;
  bootstrapped: boolean;
  publications: PublishModuleResult[];
};

export class ModularPublicationError extends Error {
  readonly code: string;
  readonly status: 400 | 404 | 409 | 503;

  constructor(code: string, message: string, status: 400 | 404 | 409 | 503 = 409) {
    super(message);
    this.name = 'ModularPublicationError';
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
  show_faq: number;
  ga4_measurement_id: string | null;
};

type HeroSlideRow = {
  id: string;
  media_asset_id: string;
  media_kind: 'image' | 'animated_image' | 'video' | null;
  media_object_key: string | null;
  title: string | null;
  description: string | null;
  cta_label: string | null;
  cta_href: string | null;
  sort_order: number;
};

type SectionRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon_type: 'icon' | 'asset';
  icon_value: string | null;
  icon_asset_id: string | null;
  icon_object_key: string | null;
  browse_background_asset_id: string | null;
  browse_background_object_key: string | null;
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
  slug: string;
  service_mode: 'online' | 'offline';
  title: string;
  body: string;
  address: string | null;
  category_id: string | null;
  category_name: string | null;
  category_enabled: number | null;
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

type ModuleVersionRow = {
  content_version: string;
  module_key: string;
  source_revision: string;
  object_count: number;
  total_bytes: number;
  is_current: number;
  published_at: string;
};

type ModuleJobRow = {
  id: string;
  module_key: string;
  status: PublishModuleJobState;
  content_version: string | null;
  error_code: string | null;
  error_message: string | null;
  requested_at: string;
  completed_at: string | null;
};

type RetentionVersionRow = {
  content_version: string;
  publish_job_id: string;
  published_at: string;
  is_current: number;
};

type Source = {
  site: SiteRow;
  heroSlides: HeroSlideRow[];
  sections: SectionRow[];
  categories: CategoryRow[];
  products: ProductRow[];
  mediaByProduct: Map<string, ProductMediaRow[]>;
  faqs: FaqRow[];
  publicTags: PublicProductTag[];
  tagsByProduct: Map<string, BoundProductTag[]>;
};

type ModulePayload = {
  moduleKey: string;
  kind: PublishModuleKind;
  sectionId: string | null;
  label: string;
  stateModel: unknown;
  mediaKeys: string[];
  buildFiles: (
    contentVersion: string,
    publishedAt: string,
  ) => Array<{
    relativePath: string;
    value: unknown;
  }>;
};

type EncodedFile = {
  relativePath: string;
  key: string;
  body: string;
  byteSize: number;
  sha256: string;
};

type PreparedPublication = {
  moduleKey: string;
  label: string;
  contentVersion: string;
  sourceRevision: string;
  publishedAt: string;
  manifestKey: string;
  objectCount: number;
  totalBytes: number;
  jobId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function encodeKeySegment(value: string): string {
  return encodeURIComponent(value);
}

function sectionModuleKey(sectionId: string): string {
  return `${SECTION_PREFIX}${sectionId}`;
}

function parseSectionModuleKey(moduleKey: string): string | null {
  if (!moduleKey.startsWith(SECTION_PREFIX)) return null;
  const sectionId = moduleKey.slice(SECTION_PREFIX.length);
  return sectionId && sectionId.length <= 120 ? sectionId : null;
}

export function normalizePublishModuleKey(value: unknown): string | null {
  if (value === undefined || value === null || value === '' || value === 'all')
    return 'all';
  if (value === 'site' || value === 'sections-index' || value === 'faq') return value;
  if (typeof value !== 'string' || value.length > 140) return null;
  const sectionId = parseSectionModuleKey(value);
  if (!sectionId || !/^[A-Za-z0-9-]+$/u.test(sectionId)) return null;
  return sectionModuleKey(sectionId);
}

function moduleBasePrefix(moduleKey: string): string {
  if (moduleKey === 'site') return 'public/modules/site';
  if (moduleKey === 'sections-index') return 'public/modules/sections-index';
  if (moduleKey === 'faq') return 'public/modules/faq';
  const sectionId = parseSectionModuleKey(moduleKey);
  if (!sectionId)
    throw new ModularPublicationError('INVALID_MODULE', '发布板块标识无效。', 400);
  return `public/modules/sections/${encodeKeySegment(sectionId)}`;
}

function moduleReference(
  pointer: ModularStorefrontPointer | null,
  moduleKey: string,
): ModuleReference | null {
  if (!pointer) return null;
  if (moduleKey === 'site') return pointer.site;
  if (moduleKey === 'sections-index') return pointer.sectionsIndex;
  if (moduleKey === 'faq') return pointer.faq;
  const sectionId = parseSectionModuleKey(moduleKey);
  return sectionId ? (pointer.sections[sectionId] ?? null) : null;
}

function pointerWithModule(
  pointer: ModularStorefrontPointer,
  moduleKey: string,
  reference: ModuleReference,
): ModularStorefrontPointer {
  if (moduleKey === 'site') return { ...pointer, site: reference };
  if (moduleKey === 'sections-index') return { ...pointer, sectionsIndex: reference };
  if (moduleKey === 'faq') return { ...pointer, faq: reference };
  const sectionId = parseSectionModuleKey(moduleKey);
  if (!sectionId) return pointer;
  return {
    ...pointer,
    sections: { ...pointer.sections, [sectionId]: reference },
  };
}

function validModuleReference(value: unknown): value is ModuleReference {
  if (!isRecord(value)) return false;
  return (
    typeof value.contentVersion === 'string' &&
    typeof value.manifestKey === 'string' &&
    typeof value.sourceRevision === 'string' &&
    typeof value.publishedAt === 'string'
  );
}

export async function readModularPointer(bucket: R2Bucket): Promise<{
  pointer: ModularStorefrontPointer | null;
  body: string | null;
  legacyDetected: boolean;
}> {
  const object = await bucket.get(CURRENT_KEY);
  if (!object) return { pointer: null, body: null, legacyDetected: false };
  const body = await object.text();
  try {
    const value = JSON.parse(body) as unknown;
    if (!isRecord(value)) return { pointer: null, body, legacyDetected: false };
    if (value.schemaVersion === 1) return { pointer: null, body, legacyDetected: true };
    if (
      value.schemaVersion !== 2 ||
      typeof value.contentVersion !== 'string' ||
      typeof value.publishedAt !== 'string' ||
      !validModuleReference(value.site) ||
      !validModuleReference(value.sectionsIndex) ||
      !validModuleReference(value.faq) ||
      !isRecord(value.sections)
    ) {
      return { pointer: null, body, legacyDetected: false };
    }
    const sections: Record<string, ModuleReference> = {};
    for (const [sectionId, reference] of Object.entries(value.sections)) {
      if (!sectionId || sectionId.length > 120 || !validModuleReference(reference)) {
        return { pointer: null, body, legacyDetected: false };
      }
      sections[sectionId] = reference;
    }
    return {
      pointer: {
        schemaVersion: 2,
        contentVersion: value.contentVersion,
        publishedAt: value.publishedAt,
        site: value.site,
        sectionsIndex: value.sectionsIndex,
        faq: value.faq,
        sections,
      },
      body,
      legacyDetected: false,
    };
  } catch {
    return { pointer: null, body, legacyDetected: false };
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

async function encodeFile(
  prefix: string,
  relativePath: string,
  value: unknown,
): Promise<EncodedFile> {
  const body = JSON.stringify(value);
  return {
    relativePath,
    key: `${prefix}/${relativePath}`,
    body,
    byteSize: new TextEncoder().encode(body).byteLength,
    sha256: await sha256Hex(body),
  };
}

function newVersion(sourceRevision: string, now: string): string {
  const versionStamp = now.replace(/[-:.TZ]/g, '');
  return `${versionStamp}-${sourceRevision.slice(0, 12)}-${crypto.randomUUID().slice(0, 8)}`;
}

function newPointerVersion(now: string): string {
  return `${now.replace(/[-:.TZ]/g, '')}-pointer-${crypto.randomUUID().slice(0, 8)}`;
}

async function loadSource(db: D1Database): Promise<Source> {
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
         ss.show_faq,
         ss.ga4_measurement_id
       FROM site_settings ss
       LEFT JOIN media_assets ma
         ON ma.id = ss.logo_asset_id
        AND ma.status = 'ready'
        AND ma.deleted_at IS NULL
       WHERE ss.id = 1`,
    )
    .first<SiteRow>();
  if (!site) {
    throw new ModularPublicationError(
      'SITE_SETTINGS_MISSING',
      '站点设置不存在，无法读取发布状态。',
    );
  }

  const heroSlides = (
    await db
      .prepare(
        `SELECT
           hs.id,
           hs.media_asset_id,
           ma.media_kind,
           ma.object_key AS media_object_key,
           hs.title,
           hs.description,
           hs.cta_label,
           hs.cta_href,
           hs.sort_order
         FROM site_hero_slides hs
         LEFT JOIN media_assets ma
           ON ma.id = hs.media_asset_id
          AND ma.status = 'ready'
          AND ma.deleted_at IS NULL
         ORDER BY hs.sort_order ASC, hs.id ASC`,
      )
      .all<HeroSlideRow>()
  ).results;

  const sections = (
    await db
      .prepare(
        `SELECT
           s.id,
           s.slug,
           s.name,
           s.description,
           s.icon_type,
           s.icon_value,
           s.icon_asset_id,
           icon.object_key AS icon_object_key,
           s.browse_background_asset_id,
           background.object_key AS browse_background_object_key,
           s.sort_order
         FROM sections s
         LEFT JOIN media_assets icon
           ON icon.id = s.icon_asset_id
          AND icon.status = 'ready'
          AND icon.deleted_at IS NULL
         LEFT JOIN media_assets background
           ON background.id = s.browse_background_asset_id
          AND background.status = 'ready'
          AND background.deleted_at IS NULL
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
           p.slug,
           p.service_mode,
           p.title,
           p.body,
           p.address,
           p.category_id,
           c.name AS category_name,
           c.is_enabled AS category_enabled,
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

  return {
    site,
    heroSlides,
    sections,
    categories,
    products,
    mediaByProduct,
    faqs,
    publicTags,
    tagsByProduct,
  };
}

function sitePublicModel(site: SiteRow, heroSlides: HeroSlideRow[]) {
  return {
    name: site.site_name,
    locationLabel: site.location_label,
    logoObjectKey: site.logo_object_key,
    homeSectionLimit: site.home_section_limit,
    hero:
      heroSlides.length > 0
        ? {
            slides: heroSlides.map((slide) => ({
              id: slide.id,
              media: {
                kind: slide.media_kind,
                objectKey: slide.media_object_key,
              },
              title: slide.title,
              description: slide.description,
              cta:
                slide.cta_label && slide.cta_href
                  ? { label: slide.cta_label, href: slide.cta_href }
                  : null,
              sortOrder: slide.sort_order,
            })),
          }
        : null,
    navigation: {
      showHot: site.show_hot === 1,
      showLatest: site.show_latest === 1,
      showMore: site.show_more === 1,
      showFaq: site.show_faq === 1,
    },
    analytics: {
      ga4MeasurementId: site.ga4_measurement_id,
    },
  };
}

function sectionsIndexModel(source: Source) {
  return source.sections.map((section) => ({
    id: section.id,
    slug: section.slug,
    name: section.name,
    description: section.description,
    icon:
      section.icon_type === 'asset'
        ? { type: 'image' as const, objectKey: section.icon_object_key, value: null }
        : { type: 'icon' as const, objectKey: null, value: section.icon_value },
    browseBackgroundObjectKey: section.browse_background_object_key,
    sortOrder: section.sort_order,
  }));
}

function sectionPublicData(source: Source, sectionId: string) {
  const section = source.sections.find((item) => item.id === sectionId);
  if (!section) {
    throw new ModularPublicationError(
      'SECTION_NOT_FOUND',
      '当前分区不存在、已停用或已进入回收站。',
      404,
    );
  }

  const categories = source.categories
    .filter((category) => category.section_id === sectionId)
    .map((category) => ({
      id: category.id,
      sectionId,
      name: category.name,
      sortOrder: category.sort_order,
    }));
  const tags = source.publicTags.filter((tag) => tag.sectionId === sectionId);
  const productRows = source.products.filter(
    (product) => product.section_id === sectionId,
  );
  const products = productRows.map((product) => {
    const media = (source.mediaByProduct.get(product.id) ?? []).map((item) => ({
      id: item.id,
      objectKey: item.object_key,
      width: item.width,
      height: item.height,
      altText: item.alt_text,
      sortOrder: item.sort_order,
    }));
    const productTags = (source.tagsByProduct.get(product.id) ?? []).map((tag) => ({
      id: tag.id,
      name: tag.name,
      sortOrder: tag.sortOrder,
    }));
    const summary = {
      id: product.id,
      slug: product.slug,
      sectionId,
      title: product.title,
      serviceMode: product.service_mode,
      address: product.address,
      category: { id: product.category_id, name: product.category_name },
      tags: productTags,
      coverObjectKey: product.effective_cover_object_key,
      isFeatured: product.is_featured === 1,
      featuredOrder: product.featured_order,
      publishedAt: product.published_at,
      sortOrder: product.sort_order,
    };
    return {
      row: product,
      summary,
      detail: {
        ...summary,
        body: product.body,
        media,
      },
    };
  });
  return { section, categories, tags, products };
}

function faqModel(source: Source) {
  return source.faqs.map((faq) => ({
    id: faq.id,
    title: faq.question,
    body: faq.answer,
    sortOrder: faq.sort_order,
  }));
}

function modulePayload(source: Source, moduleKey: string): ModulePayload {
  if (moduleKey === 'site') {
    const site = sitePublicModel(source.site, source.heroSlides);
    return {
      moduleKey,
      kind: 'site',
      sectionId: null,
      label: '站点设置',
      stateModel: site,
      mediaKeys: uniqueStrings([
        source.site.logo_object_key,
        ...source.heroSlides.map((slide) => slide.media_object_key),
      ]),
      buildFiles: (contentVersion, publishedAt) => [
        {
          relativePath: 'site.json',
          value: { schemaVersion: 2, moduleKey, contentVersion, publishedAt, site },
        },
      ],
    };
  }

  if (moduleKey === 'sections-index') {
    const sections = sectionsIndexModel(source);
    return {
      moduleKey,
      kind: 'sections-index',
      sectionId: null,
      label: '分区导航',
      stateModel: sections,
      mediaKeys: uniqueStrings(
        source.sections.flatMap((section) => [
          section.icon_object_key,
          section.browse_background_object_key,
        ]),
      ),
      buildFiles: (contentVersion, publishedAt) => [
        {
          relativePath: 'sections.json',
          value: { schemaVersion: 2, moduleKey, contentVersion, publishedAt, sections },
        },
      ],
    };
  }

  if (moduleKey === 'faq') {
    const faqs = faqModel(source);
    return {
      moduleKey,
      kind: 'faq',
      sectionId: null,
      label: 'FAQ',
      stateModel: faqs,
      mediaKeys: [],
      buildFiles: (contentVersion, publishedAt) => [
        {
          relativePath: 'faq.json',
          value: { schemaVersion: 2, moduleKey, contentVersion, publishedAt, faqs },
        },
      ],
    };
  }

  const sectionId = parseSectionModuleKey(moduleKey);
  if (!sectionId) {
    throw new ModularPublicationError('INVALID_MODULE', '发布板块标识无效。', 400);
  }
  const data = sectionPublicData(source, sectionId);
  const stateModel = {
    sectionId,
    categories: data.categories,
    tags: data.tags,
    products: data.products.map((product) => product.detail),
  };
  const mediaKeys = uniqueStrings(
    data.products.flatMap((product) => [
      product.summary.coverObjectKey,
      ...product.detail.media.map((media) => media.objectKey),
    ]),
  );

  return {
    moduleKey,
    kind: 'section',
    sectionId,
    label: data.section.name,
    stateModel,
    mediaKeys,
    buildFiles: (contentVersion, publishedAt) => [
      {
        relativePath: 'section.json',
        value: {
          schemaVersion: 2,
          moduleKey,
          contentVersion,
          publishedAt,
          sectionId,
          categories: data.categories,
          tags: data.tags,
          products: data.products.map((product) => product.summary),
        },
      },
      ...data.products.map((product) => ({
        relativePath: `products/${encodeKeySegment(product.row.id)}.json`,
        value: {
          schemaVersion: 2,
          moduleKey,
          contentVersion,
          publishedAt,
          product: product.detail,
        },
      })),
    ],
  };
}

function validatePayload(source: Source, payload: ModulePayload): void {
  if (payload.kind === 'site') {
    if (!source.site.media_base_url) {
      throw new ModularPublicationError(
        'MEDIA_DOMAIN_REQUIRED',
        '发布站点设置前必须先配置并测试 R2 自定义域名。',
      );
    }
    if (source.site.logo_asset_id && !source.site.logo_object_key) {
      throw new ModularPublicationError(
        'SITE_LOGO_INVALID',
        '当前站点 Logo 已不可用，请重新设置后再发布。',
      );
    }
    for (const slide of source.heroSlides) {
      if (!slide.media_object_key || !slide.media_kind) {
        throw new ModularPublicationError(
          'SITE_HERO_MEDIA_INVALID',
          '当前 Hero 存在不可用素材，请在站点设置中重新选择后再发布。',
        );
      }
    }
    return;
  }

  if (payload.kind === 'sections-index') {
    for (const section of source.sections) {
      if (section.icon_type === 'asset' && !section.icon_object_key) {
        throw new ModularPublicationError(
          'SECTION_ICON_INVALID',
          `分区“${section.name}”的图片图标已不可用，请重新设置后再发布。`,
        );
      }
      if (section.browse_background_asset_id && !section.browse_background_object_key) {
        throw new ModularPublicationError(
          'SECTION_BROWSE_BACKGROUND_INVALID',
          `分区“${section.name}”的 Browse 背景图已不可用，请重新设置后再发布。`,
        );
      }
    }
    return;
  }

  if (payload.kind !== 'section' || !payload.sectionId) return;
  const products = source.products.filter(
    (product) => product.section_id === payload.sectionId,
  );
  for (const product of products) {
    if (
      product.category_id &&
      (!product.category_name || product.category_enabled !== 1)
    ) {
      throw new ModularPublicationError(
        'PRODUCT_CATEGORY_INVALID',
        `产品“${product.title}”选择的分类已不可用，当前分区无法发布。`,
      );
    }
    if (product.service_mode === 'offline' && !product.address) {
      throw new ModularPublicationError(
        'PRODUCT_ADDRESS_REQUIRED',
        `产品“${product.title}”缺少服务地址。`,
      );
    }
    if (
      (source.mediaByProduct.get(product.id) ?? []).length === 0 ||
      !product.effective_cover_object_key
    ) {
      throw new ModularPublicationError(
        'PRODUCT_MEDIA_INVALID',
        `产品“${product.title}”缺少可用图片。`,
      );
    }
  }
}

async function payloadRevision(payload: ModulePayload): Promise<string> {
  return sha256Hex(JSON.stringify(payload.stateModel));
}

function desiredModuleKeys(source: Source): string[] {
  return [
    'site',
    'sections-index',
    'faq',
    ...source.sections.map((section) => sectionModuleKey(section.id)),
  ];
}

function blankPointer(
  now: string,
  references: Map<string, ModuleReference>,
  source: Source,
): ModularStorefrontPointer {
  const site = references.get('site');
  const sectionsIndex = references.get('sections-index');
  const faq = references.get('faq');
  if (!site || !sectionsIndex || !faq) {
    throw new ModularPublicationError(
      'PUBLISH_BOOTSTRAP_INCOMPLETE',
      '首次模块化发布缺少必要的全局板块。',
    );
  }
  const sections: Record<string, ModuleReference> = {};
  for (const section of source.sections) {
    const reference = references.get(sectionModuleKey(section.id));
    if (!reference) {
      throw new ModularPublicationError(
        'PUBLISH_BOOTSTRAP_INCOMPLETE',
        `首次模块化发布缺少分区“${section.name}”。`,
      );
    }
    sections[section.id] = reference;
  }
  return {
    schemaVersion: 2,
    contentVersion: newPointerVersion(now),
    publishedAt: now,
    site,
    sectionsIndex,
    faq,
    sections,
  };
}

async function preparePublication(
  db: D1Database,
  bucket: R2Bucket,
  source: Source,
  payload: ModulePayload,
  sourceRevision: string,
  previousReference: ModuleReference | null,
  now: string,
): Promise<PreparedPublication> {
  validatePayload(source, payload);
  const jobId = crypto.randomUUID();
  const contentVersion = newVersion(sourceRevision, now);
  const prefix = `${moduleBasePrefix(payload.moduleKey)}/${contentVersion}`;

  await db
    .prepare(
      `INSERT INTO publish_module_jobs (
         id, module_key, status, source_revision, content_version,
         previous_content_version, requested_at, started_at
       ) VALUES (?, ?, 'building', ?, ?, ?, ?, ?)`,
    )
    .bind(
      jobId,
      payload.moduleKey,
      sourceRevision,
      contentVersion,
      previousReference?.contentVersion ?? null,
      now,
      now,
    )
    .run();

  try {
    const files = await Promise.all(
      payload
        .buildFiles(contentVersion, now)
        .map((file) => encodeFile(prefix, file.relativePath, file.value)),
    );
    const manifestValue = {
      schemaVersion: 2,
      moduleKey: payload.moduleKey,
      contentVersion,
      sourceRevision,
      publishedAt: now,
      mediaKeys: payload.mediaKeys,
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
          httpMetadata: {
            contentType: 'application/json; charset=utf-8',
            cacheControl: IMMUTABLE_CACHE,
          },
          customMetadata: {
            moduleKey: payload.moduleKey,
            contentVersion,
            sourceRevision,
          },
        }),
      ),
    );
    const objectCount = files.length + 1;
    const totalBytes =
      files.reduce((sum, file) => sum + file.byteSize, 0) + manifest.byteSize;

    await db
      .prepare(
        `INSERT INTO publish_module_versions (
           content_version, module_key, publish_job_id, manifest_key, manifest_sha256,
           source_revision, state_revision, media_keys_json,
           object_count, total_bytes, is_current, published_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      )
      .bind(
        contentVersion,
        payload.moduleKey,
        jobId,
        manifest.key,
        manifest.sha256,
        sourceRevision,
        sourceRevision,
        JSON.stringify(payload.mediaKeys),
        objectCount,
        totalBytes,
        now,
      )
      .run();

    return {
      moduleKey: payload.moduleKey,
      label: payload.label,
      contentVersion,
      sourceRevision,
      publishedAt: now,
      manifestKey: manifest.key,
      objectCount,
      totalBytes,
      jobId,
    };
  } catch (error) {
    await markJobFailed(db, jobId, error);
    await deleteR2PrefixBestEffort(bucket, prefix);
    throw error;
  }
}

async function markJobFailed(
  db: D1Database,
  jobId: string,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message.slice(0, 1000) : '未知发布错误';
  try {
    await db
      .prepare(
        `UPDATE publish_module_jobs
         SET status = 'failed', error_code = 'PUBLISH_FAILED', error_message = ?, completed_at = ?
         WHERE id = ? AND status = 'building'`,
      )
      .bind(message, new Date().toISOString(), jobId)
      .run();
  } catch {
    // Preserve the original publication error.
  }
}

async function deleteR2PrefixBestEffort(bucket: R2Bucket, prefix: string): Promise<void> {
  try {
    let cursor: string | undefined;
    do {
      const page = await bucket.list({
        prefix: `${prefix}/`,
        ...(cursor ? { cursor } : {}),
        limit: 1000,
      });
      for (const batch of chunk(
        page.objects.map((object) => object.key),
        R2_DELETE_BATCH_SIZE,
      )) {
        if (batch.length > 0) await bucket.delete(batch);
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  } catch {
    // Orphan cleanup is best effort and is retried by retention on later publishes.
  }
}

async function ensureNoActivePublish(db: D1Database, now: string): Promise<void> {
  const staleBefore = new Date(new Date(now).getTime() - 15 * 60_000).toISOString();
  const active = await db
    .prepare(
      `SELECT id, requested_at
       FROM publish_module_jobs
       WHERE status = 'building'
       ORDER BY requested_at DESC LIMIT 1`,
    )
    .first<{ id: string; requested_at: string }>();
  if (active && active.requested_at >= staleBefore) {
    throw new ModularPublicationError(
      'PUBLISH_IN_PROGRESS',
      '已有前台发布任务正在执行，请稍后再试。',
    );
  }
  if (active) {
    await db
      .prepare(
        `UPDATE publish_module_jobs
         SET status = 'cancelled', error_code = 'STALE_JOB',
             error_message = 'Stale modular publish replaced by a new publish.', completed_at = ?
         WHERE status = 'building' AND requested_at < ?`,
      )
      .bind(now, staleBefore)
      .run();
  }
}

async function listModuleVersions(db: D1Database): Promise<ModuleVersionRow[]> {
  return (
    await db
      .prepare(
        `SELECT
           v.content_version,
           v.module_key,
           v.source_revision,
           v.object_count,
           v.total_bytes,
           v.is_current,
           v.published_at
         FROM publish_module_versions v
         JOIN publish_module_jobs j ON j.id = v.publish_job_id
         WHERE j.status = 'published'
         ORDER BY v.module_key ASC, v.published_at DESC, v.content_version DESC`,
      )
      .all<ModuleVersionRow>()
  ).results;
}

async function listModuleJobs(db: D1Database): Promise<ModuleJobRow[]> {
  return (
    await db
      .prepare(
        `SELECT id, module_key, status, content_version, error_code, error_message,
                requested_at, completed_at
         FROM publish_module_jobs
         ORDER BY requested_at DESC, id DESC`,
      )
      .all<ModuleJobRow>()
  ).results;
}

function publicVersion(
  row: ModuleVersionRow,
  currentVersion: string | null,
): PublishModuleVersion {
  return {
    moduleKey: row.module_key,
    contentVersion: row.content_version,
    sourceRevision: row.source_revision,
    publishedAt: row.published_at,
    isCurrent: row.content_version === currentVersion,
    objectCount: row.object_count,
    totalBytes: row.total_bytes,
  };
}

export async function getModularPublishStatus(
  db: D1Database,
  bucket: R2Bucket,
): Promise<ModularPublishStatus> {
  const [source, pointerResult, versionRows, jobRows] = await Promise.all([
    loadSource(db),
    readModularPointer(bucket),
    listModuleVersions(db),
    listModuleJobs(db),
  ]);

  const payloads = desiredModuleKeys(source).map((key) => modulePayload(source, key));
  const revisions = new Map<string, string>();
  await Promise.all(
    payloads.map(async (payload) => {
      revisions.set(payload.moduleKey, await payloadRevision(payload));
    }),
  );

  const versionsByModule = new Map<string, ModuleVersionRow[]>();
  for (const row of versionRows) {
    const rows = versionsByModule.get(row.module_key) ?? [];
    if (rows.length < RETAINED_VERSION_COUNT) rows.push(row);
    versionsByModule.set(row.module_key, rows);
  }
  const lastJobByModule = new Map<string, ModuleJobRow>();
  for (const row of jobRows) {
    if (!lastJobByModule.has(row.module_key)) lastJobByModule.set(row.module_key, row);
  }

  const modules: PublishModuleStatus[] = payloads.map((payload) => {
    const reference = moduleReference(pointerResult.pointer, payload.moduleKey);
    const revision = revisions.get(payload.moduleKey) ?? '';
    const lastJob = lastJobByModule.get(payload.moduleKey) ?? null;
    return {
      key: payload.moduleKey,
      kind: payload.kind,
      sectionId: payload.sectionId,
      label: payload.label,
      currentVersion: reference?.contentVersion ?? null,
      publishedAt: reference?.publishedAt ?? null,
      isCurrent: Boolean(reference && reference.sourceRevision === revision),
      versions: (versionsByModule.get(payload.moduleKey) ?? []).map((row) =>
        publicVersion(row, reference?.contentVersion ?? null),
      ),
      lastJob: lastJob
        ? {
            id: lastJob.id,
            status: lastJob.status,
            contentVersion: lastJob.content_version,
            errorCode: lastJob.error_code,
            errorMessage: lastJob.error_message,
            requestedAt: lastJob.requested_at,
            completedAt: lastJob.completed_at,
          }
        : null,
    };
  });
  const dirtyCount = modules.filter((module) => !module.isCurrent).length;

  return {
    pointerVersion: pointerResult.pointer?.contentVersion ?? null,
    publishedAt: pointerResult.pointer?.publishedAt ?? null,
    isCurrent: Boolean(pointerResult.pointer) && dirtyCount === 0,
    dirtyCount,
    bootstrapRequired: pointerResult.pointer === null,
    legacyPointerDetected: pointerResult.legacyDetected,
    mediaBaseUrl: source.site.media_base_url,
    modules,
  };
}

function referenceFromPrepared(publication: PreparedPublication): ModuleReference {
  return {
    contentVersion: publication.contentVersion,
    manifestKey: publication.manifestKey,
    sourceRevision: publication.sourceRevision,
    publishedAt: publication.publishedAt,
  };
}

async function pruneModuleRetention(
  db: D1Database,
  bucket: R2Bucket,
  moduleKey: string,
): Promise<void> {
  const rows = (
    await db
      .prepare(
        `SELECT v.content_version, v.publish_job_id, v.published_at, v.is_current
         FROM publish_module_versions v
         JOIN publish_module_jobs j ON j.id = v.publish_job_id
         WHERE v.module_key = ? AND j.status = 'published'
         ORDER BY v.is_current DESC, v.published_at DESC, v.content_version DESC`,
      )
      .bind(moduleKey)
      .all<RetentionVersionRow>()
  ).results;
  const retained = rows.slice(0, RETAINED_VERSION_COUNT);
  const stale = rows.slice(RETAINED_VERSION_COUNT);

  for (const row of stale) {
    await deleteR2PrefixBestEffort(
      bucket,
      `${moduleBasePrefix(moduleKey)}/${row.content_version}`,
    );
  }
  if (stale.length > 0) {
    await db.batch(
      stale.map((row) =>
        db
          .prepare('DELETE FROM publish_module_versions WHERE content_version = ?')
          .bind(row.content_version),
      ),
    );
  }

  const protectedJobIds = new Set(retained.map((row) => row.publish_job_id));
  const jobs = (
    await db
      .prepare(
        `SELECT id
         FROM publish_module_jobs
         WHERE module_key = ? AND status NOT IN ('building')
         ORDER BY requested_at DESC, id DESC`,
      )
      .bind(moduleKey)
      .all<{ id: string }>()
  ).results;
  const extraSlots = Math.max(0, RETAINED_VERSION_COUNT - protectedJobIds.size);
  const extraKeep = jobs
    .filter((job) => !protectedJobIds.has(job.id))
    .slice(0, extraSlots);
  const keepIds = new Set([...protectedJobIds, ...extraKeep.map((job) => job.id)]);
  const staleJobIds = jobs.map((job) => job.id).filter((id) => !keepIds.has(id));
  if (staleJobIds.length > 0) {
    await db.batch(
      staleJobIds.map((id) =>
        db.prepare('DELETE FROM publish_module_jobs WHERE id = ?').bind(id),
      ),
    );
  }
}

async function pruneModulesBestEffort(
  db: D1Database,
  bucket: R2Bucket,
  moduleKeys: string[],
): Promise<void> {
  for (const moduleKey of [...new Set(moduleKeys)]) {
    try {
      await pruneModuleRetention(db, bucket, moduleKey);
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'storefront.module_retention_failed',
          moduleKey,
          errorName: error instanceof Error ? error.name : 'UnknownError',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown retention error',
        }),
      );
    }
  }
}

export async function publishModularStorefront(
  db: D1Database,
  bucket: R2Bucket,
  requestId: string,
  requestedModuleKey: string = 'all',
): Promise<ModularPublishResult> {
  const normalized = normalizePublishModuleKey(requestedModuleKey);
  if (!normalized) {
    throw new ModularPublicationError('INVALID_MODULE', '请选择有效的发布板块。', 400);
  }
  const now = new Date().toISOString();
  await ensureNoActivePublish(db, now);

  const [source, pointerResult] = await Promise.all([
    loadSource(db),
    readModularPointer(bucket),
  ]);
  const allKeys = desiredModuleKeys(source);
  const enabledSectionIds = new Set(source.sections.map((section) => section.id));
  const requestedKeys = new Set<string>();
  const bootstrapped = pointerResult.pointer === null;

  if (bootstrapped || normalized === 'all') {
    allKeys.forEach((key) => requestedKeys.add(key));
  } else if (normalized === 'sections-index') {
    requestedKeys.add('sections-index');
    for (const section of source.sections) {
      if (!pointerResult.pointer?.sections[section.id])
        requestedKeys.add(sectionModuleKey(section.id));
    }
  } else {
    if (normalized.startsWith(SECTION_PREFIX)) {
      const sectionId = parseSectionModuleKey(normalized);
      if (!sectionId || !enabledSectionIds.has(sectionId)) {
        throw new ModularPublicationError(
          'SECTION_NOT_FOUND',
          '当前分区不存在、已停用或已进入回收站。',
          404,
        );
      }
    }
    requestedKeys.add(normalized);
  }

  const payloads = new Map<string, ModulePayload>();
  const revisions = new Map<string, string>();
  await Promise.all(
    [...requestedKeys].map(async (key) => {
      const payload = modulePayload(source, key);
      payloads.set(key, payload);
      revisions.set(key, await payloadRevision(payload));
    }),
  );

  const prepared: PreparedPublication[] = [];
  const results: PublishModuleResult[] = [];
  const references = new Map<string, ModuleReference>();
  if (pointerResult.pointer) {
    references.set('site', pointerResult.pointer.site);
    references.set('sections-index', pointerResult.pointer.sectionsIndex);
    references.set('faq', pointerResult.pointer.faq);
    for (const [sectionId, reference] of Object.entries(pointerResult.pointer.sections)) {
      references.set(sectionModuleKey(sectionId), reference);
    }
  }

  for (const key of requestedKeys) {
    const payload = payloads.get(key);
    const revision = revisions.get(key);
    if (!payload || !revision) continue;
    const currentReference = references.get(key) ?? null;
    if (currentReference?.sourceRevision === revision) {
      results.push({
        moduleKey: key,
        label: payload.label,
        contentVersion: currentReference.contentVersion,
        sourceRevision: revision,
        publishedAt: currentReference.publishedAt,
        objectCount: 0,
        totalBytes: 0,
        unchanged: true,
      });
      continue;
    }
    const publication = await preparePublication(
      db,
      bucket,
      source,
      payload,
      revision,
      currentReference,
      now,
    );
    prepared.push(publication);
    references.set(key, referenceFromPrepared(publication));
    results.push({
      moduleKey: key,
      label: payload.label,
      contentVersion: publication.contentVersion,
      sourceRevision: publication.sourceRevision,
      publishedAt: publication.publishedAt,
      objectCount: publication.objectCount,
      totalBytes: publication.totalBytes,
      unchanged: false,
    });
  }

  if (prepared.length === 0 && pointerResult.pointer) {
    return {
      pointerVersion: pointerResult.pointer.contentVersion,
      publishedAt: pointerResult.pointer.publishedAt,
      bootstrapped: false,
      publications: results,
    };
  }

  let nextPointer = pointerResult.pointer
    ? {
        ...pointerResult.pointer,
        contentVersion: newPointerVersion(now),
        publishedAt: now,
        sections: { ...pointerResult.pointer.sections },
      }
    : blankPointer(now, references, source);
  for (const publication of prepared) {
    nextPointer = pointerWithModule(
      nextPointer,
      publication.moduleKey,
      referenceFromPrepared(publication),
    );
  }

  if (requestedKeys.has('sections-index') || bootstrapped || normalized === 'all') {
    const sections: Record<string, ModuleReference> = {};
    for (const section of source.sections) {
      const reference = references.get(sectionModuleKey(section.id));
      if (reference) sections[section.id] = reference;
    }
    nextPointer = { ...nextPointer, sections };
  }

  await bucket.put(CURRENT_KEY, JSON.stringify(nextPointer), {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: POINTER_CACHE,
    },
  });

  try {
    const statements: D1PreparedStatement[] = [];
    for (const publication of prepared) {
      statements.push(
        db
          .prepare(
            'UPDATE publish_module_versions SET is_current = 0 WHERE module_key = ? AND is_current = 1',
          )
          .bind(publication.moduleKey),
        db
          .prepare(
            'UPDATE publish_module_versions SET is_current = 1 WHERE content_version = ?',
          )
          .bind(publication.contentVersion),
        db
          .prepare(
            `UPDATE publish_module_jobs
             SET status = 'published', completed_at = ?, error_code = NULL, error_message = NULL
             WHERE id = ?`,
          )
          .bind(now, publication.jobId),
        createAuditLogStatement(db, {
          action: 'storefront.module_published',
          entityType: 'publish_module',
          entityId: publication.moduleKey,
          requestId,
          metadata: {
            contentVersion: publication.contentVersion,
            sourceRevision: publication.sourceRevision,
            previousContentVersion:
              moduleReference(pointerResult.pointer, publication.moduleKey)
                ?.contentVersion ?? null,
            objectCount: publication.objectCount,
            totalBytes: publication.totalBytes,
            bootstrapped,
          },
          createdAt: now,
        }),
      );
    }
    if (statements.length > 0) await db.batch(statements);
  } catch (error) {
    if (pointerResult.body !== null) {
      await bucket.put(CURRENT_KEY, pointerResult.body, {
        httpMetadata: {
          contentType: 'application/json; charset=utf-8',
          cacheControl: POINTER_CACHE,
        },
      });
    } else {
      await bucket.delete(CURRENT_KEY);
    }
    for (const publication of prepared) await markJobFailed(db, publication.jobId, error);
    throw error;
  }

  if (bootstrapped) {
    try {
      await db.prepare('DELETE FROM asset_cleanup_guards').run();
    } catch {
      // Modular retained-version media indexes supersede legacy cleanup guards.
    }
  }
  await pruneModulesBestEffort(
    db,
    bucket,
    prepared.map((publication) => publication.moduleKey),
  );
  return {
    pointerVersion: nextPointer.contentVersion,
    publishedAt: nextPointer.publishedAt,
    bootstrapped,
    publications: results,
  };
}

export async function rollbackModularModule(
  db: D1Database,
  bucket: R2Bucket,
  moduleKeyInput: string,
  contentVersion: string,
  requestId: string,
): Promise<PublishModuleVersion> {
  const moduleKey = normalizePublishModuleKey(moduleKeyInput);
  if (!moduleKey || moduleKey === 'all') {
    throw new ModularPublicationError(
      'INVALID_MODULE',
      '请选择需要回退的发布板块。',
      400,
    );
  }
  if (
    !contentVersion ||
    contentVersion.length > 180 ||
    !/^[A-Za-z0-9-]+$/u.test(contentVersion)
  ) {
    throw new ModularPublicationError(
      'INVALID_PUBLISH_VERSION',
      '前台版本标识无效。',
      400,
    );
  }

  const row = await db
    .prepare(
      `SELECT
         v.content_version,
         v.module_key,
         v.source_revision,
         v.object_count,
         v.total_bytes,
         v.is_current,
         v.published_at,
         v.manifest_key
       FROM publish_module_versions v
       JOIN publish_module_jobs j ON j.id = v.publish_job_id
       WHERE v.module_key = ? AND v.content_version = ? AND j.status = 'published'`,
    )
    .bind(moduleKey, contentVersion)
    .first<ModuleVersionRow & { manifest_key: string }>();
  if (!row) {
    throw new ModularPublicationError(
      'PUBLISH_VERSION_NOT_FOUND',
      '该板块版本已不存在。',
      404,
    );
  }
  if (!(await bucket.head(row.manifest_key))) {
    throw new ModularPublicationError(
      'PUBLISH_VERSION_OBJECTS_MISSING',
      '该板块的 R2 快照已不完整，不能回退。',
    );
  }

  const pointerResult = await readModularPointer(bucket);
  const pointer = pointerResult.pointer;
  if (!pointer) {
    throw new ModularPublicationError(
      'MODULAR_POINTER_REQUIRED',
      '模块化前台尚未完成首次发布。',
    );
  }
  const current = moduleReference(pointer, moduleKey);
  if (!current) {
    throw new ModularPublicationError(
      'MODULE_NOT_PUBLISHED',
      '该板块当前没有在线版本。',
      404,
    );
  }
  if (current.contentVersion === contentVersion) {
    return publicVersion(row, contentVersion);
  }

  const reference: ModuleReference = {
    contentVersion: row.content_version,
    manifestKey: row.manifest_key,
    sourceRevision: row.source_revision,
    publishedAt: row.published_at,
  };
  const now = new Date().toISOString();
  let nextPointer = pointerWithModule(
    { ...pointer, contentVersion: newPointerVersion(now), publishedAt: now },
    moduleKey,
    reference,
  );
  if (moduleKey.startsWith(SECTION_PREFIX)) {
    const sectionId = parseSectionModuleKey(moduleKey);
    if (!sectionId || !pointer.sections[sectionId]) {
      throw new ModularPublicationError(
        'MODULE_NOT_PUBLISHED',
        '该分区当前不在前台导航中，不能回退。',
        404,
      );
    }
    nextPointer = {
      ...nextPointer,
      sections: { ...nextPointer.sections, [sectionId]: reference },
    };
  }

  await bucket.put(CURRENT_KEY, JSON.stringify(nextPointer), {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: POINTER_CACHE,
    },
  });
  try {
    await db.batch([
      db
        .prepare(
          'UPDATE publish_module_versions SET is_current = 0 WHERE module_key = ? AND is_current = 1',
        )
        .bind(moduleKey),
      db
        .prepare(
          'UPDATE publish_module_versions SET is_current = 1 WHERE module_key = ? AND content_version = ?',
        )
        .bind(moduleKey, contentVersion),
      createAuditLogStatement(db, {
        action: 'storefront.module_rolled_back',
        entityType: 'publish_module',
        entityId: moduleKey,
        requestId,
        metadata: {
          previousContentVersion: current.contentVersion,
          targetContentVersion: contentVersion,
        },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (pointerResult.body !== null) {
      await bucket.put(CURRENT_KEY, pointerResult.body, {
        httpMetadata: {
          contentType: 'application/json; charset=utf-8',
          cacheControl: POINTER_CACHE,
        },
      });
    }
    throw error;
  }

  return publicVersion(row, contentVersion);
}
