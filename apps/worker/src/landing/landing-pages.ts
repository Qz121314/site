import { getProduct, type ProductRecord, type ProductStatus } from '../products/products';
import { buildAssetPublicUrl, getMediaBaseUrl } from '../assets/asset-library';

export type LandingTemplateKey = 'direct_response' | 'visual_story' | 'chat_first';
export type LandingChatTemplateKey = 'match_landing';
export type LandingStatus = 'draft' | 'published' | 'archived';

export type LandingInput = {
  name: string;
  slug: string;
  productId: string;
  templateKey: LandingTemplateKey;
  chatTemplateKey: LandingChatTemplateKey;
  headlineOverride: string | null;
  subheadlineOverride: string | null;
  heroAssetId: string | null;
  ctaLabelOverride: string | null;
  chatWelcomeOverride: string | null;
  status: LandingStatus;
};

export type LandingRecord = LandingInput & {
  id: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type LandingProductSummary = Pick<
  ProductRecord,
  | 'id'
  | 'sectionId'
  | 'title'
  | 'status'
  | 'isVisible'
  | 'effectiveCoverUrl'
  | 'media'
  | 'conversionGroupName'
  | 'buttonLabel'
> & { sectionName: string };

export type LandingBuildModel = {
  landing: LandingRecord;
  product: ProductRecord;
  resolved: {
    headline: string;
    subheadline: string | null;
    body: string;
    heroAssetId: string | null;
    heroAsset: LandingHeroAsset | null;
    ctaLabel: string | null;
    chatWelcome: string | null;
  };
  templateKey: LandingTemplateKey;
  chatTemplateKey: LandingChatTemplateKey;
};

export type LandingHeroAsset = {
  assetId: string;
  objectKey: string;
  publicUrl: string | null;
  width: number | null;
  height: number | null;
};

export function resolveLandingPresentation(
  landing: Pick<
    LandingRecord,
    'headlineOverride' | 'subheadlineOverride' | 'heroAssetId' | 'ctaLabelOverride'
  >,
  product: Pick<
    ProductRecord,
    'title' | 'body' | 'effectiveCoverAssetId' | 'buttonLabel'
  >,
  heroAsset: LandingHeroAsset | null,
) {
  return {
    headline: landing.headlineOverride ?? product.title,
    subheadline: landing.subheadlineOverride,
    body: product.body,
    heroAssetId: landing.heroAssetId ?? product.effectiveCoverAssetId,
    heroAsset,
    ctaLabel: landing.ctaLabelOverride ?? product.buttonLabel,
  };
}

type LandingRow = {
  id: string;
  name: string;
  slug: string;
  product_id: string;
  template_key: LandingTemplateKey;
  chat_template_key: LandingChatTemplateKey;
  headline_override: string | null;
  subheadline_override: string | null;
  hero_asset_id: string | null;
  cta_label_override: string | null;
  chat_welcome_override: string | null;
  status: LandingStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type ValidationResult =
  { ok: true; value: LandingInput } | { ok: false; field: string; message: string };

const RESERVED_SLUGS = new Set(['api', 'go', 'l', 'admin', 'assets', 'public']);

export function normalizeLandingSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .slice(0, 120);
}

function optionalText(value: unknown): string | null | undefined {
  if (value === null || value === '') return null;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function validateLandingInput(value: unknown): ValidationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return { ok: false, field: 'body', message: '落地页数据无效。' };
  const input = value as Record<string, unknown>;
  if (typeof input.name !== 'string' || !input.name.trim())
    return { ok: false, field: 'name', message: '请输入落地页名称。' };
  if (typeof input.slug !== 'string')
    return { ok: false, field: 'slug', message: '请输入落地页地址。' };
  const slug = normalizeLandingSlug(input.slug);
  if (!slug || RESERVED_SLUGS.has(slug))
    return { ok: false, field: 'slug', message: '落地页地址无效或为系统保留地址。' };
  if (typeof input.productId !== 'string' || !input.productId)
    return { ok: false, field: 'productId', message: '请选择来源产品。' };
  const templateKey = input.templateKey ?? 'direct_response';
  if (
    templateKey !== 'direct_response' &&
    templateKey !== 'visual_story' &&
    templateKey !== 'chat_first'
  )
    return { ok: false, field: 'templateKey', message: '模板类型无效。' };
  const chatTemplateKey = input.chatTemplateKey ?? 'match_landing';
  if (chatTemplateKey !== 'match_landing')
    return { ok: false, field: 'chatTemplateKey', message: 'Chat 模板类型无效。' };
  const status = input.status ?? 'draft';
  if (status !== 'draft' && status !== 'published' && status !== 'archived')
    return { ok: false, field: 'status', message: '状态无效。' };
  const fields = [
    'headlineOverride',
    'subheadlineOverride',
    'ctaLabelOverride',
    'chatWelcomeOverride',
  ] as const;
  const optional: Record<string, string | null> = {};
  for (const field of fields) {
    const parsed = optionalText(input[field]);
    if (parsed === undefined)
      return { ok: false, field, message: '文本覆盖值必须为空或有效文本。' };
    optional[field] = parsed;
  }
  if (
    input.heroAssetId !== null &&
    input.heroAssetId !== undefined &&
    typeof input.heroAssetId !== 'string'
  )
    return { ok: false, field: 'heroAssetId', message: 'Hero 素材引用无效。' };
  if (status === 'published' && templateKey !== 'direct_response')
    return {
      ok: false,
      field: 'templateKey',
      message: '当前只有 Direct Response 模板可以发布。',
    };
  return {
    ok: true,
    value: {
      name: input.name.trim(),
      slug,
      productId: input.productId,
      templateKey,
      chatTemplateKey,
      headlineOverride: optional.headlineOverride ?? null,
      subheadlineOverride: optional.subheadlineOverride ?? null,
      heroAssetId: (input.heroAssetId as string | null | undefined) ?? null,
      ctaLabelOverride: optional.ctaLabelOverride ?? null,
      chatWelcomeOverride: optional.chatWelcomeOverride ?? null,
      status,
    },
  };
}

function mapLanding(row: LandingRow): LandingRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    productId: row.product_id,
    templateKey: row.template_key,
    chatTemplateKey: row.chat_template_key,
    headlineOverride: row.headline_override,
    subheadlineOverride: row.subheadline_override,
    heroAssetId: row.hero_asset_id,
    ctaLabelOverride: row.cta_label_override,
    chatWelcomeOverride: row.chat_welcome_override,
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

const SELECT = `SELECT id,name,slug,product_id,template_key,chat_template_key,headline_override,subheadline_override,hero_asset_id,cta_label_override,chat_welcome_override,status,published_at,created_at,updated_at,deleted_at FROM landing_pages`;

export async function getLanding(
  db: D1Database,
  id: string,
): Promise<LandingRecord | null> {
  const row = await db.prepare(`${SELECT} WHERE id = ?`).bind(id).first<LandingRow>();
  return row ? mapLanding(row) : null;
}

export async function listLandings(
  db: D1Database,
  scope: 'active' | 'trash' | 'all' = 'active',
): Promise<LandingRecord[]> {
  const where =
    scope === 'active'
      ? 'WHERE deleted_at IS NULL'
      : scope === 'trash'
        ? 'WHERE deleted_at IS NOT NULL'
        : '';
  const rows = await db
    .prepare(`${SELECT} ${where} ORDER BY updated_at DESC`)
    .all<LandingRow>();
  return rows.results.map(mapLanding);
}

export function createLandingStatement(
  db: D1Database,
  input: LandingInput,
  now: string,
): { landing: LandingRecord; statement: D1PreparedStatement } {
  const landing: LandingRecord = {
    id: crypto.randomUUID(),
    ...input,
    publishedAt: input.status === 'published' ? now : null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  return {
    landing,
    statement: db
      .prepare(
        `INSERT INTO landing_pages (id,name,slug,product_id,template_key,chat_template_key,headline_override,subheadline_override,hero_asset_id,cta_label_override,chat_welcome_override,status,published_at,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        landing.id,
        input.name,
        input.slug,
        input.productId,
        input.templateKey,
        input.chatTemplateKey,
        input.headlineOverride,
        input.subheadlineOverride,
        input.heroAssetId,
        input.ctaLabelOverride,
        input.chatWelcomeOverride,
        input.status,
        landing.publishedAt,
        now,
        now,
        null,
      ),
  };
}

export function updateLandingStatement(
  db: D1Database,
  id: string,
  input: LandingInput,
  publishedAt: string | null,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE landing_pages SET name=?,slug=?,product_id=?,template_key=?,chat_template_key=?,headline_override=?,subheadline_override=?,hero_asset_id=?,cta_label_override=?,chat_welcome_override=?,status=?,published_at=?,updated_at=? WHERE id=?`,
    )
    .bind(
      input.name,
      input.slug,
      input.productId,
      input.templateKey,
      input.chatTemplateKey,
      input.headlineOverride,
      input.subheadlineOverride,
      input.heroAssetId,
      input.ctaLabelOverride,
      input.chatWelcomeOverride,
      input.status,
      publishedAt,
      now,
      id,
    );
}

export function isLandingConflictError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('landing_pages_active_slug_unique') ||
      error.message.includes('landing_pages.slug'))
  );
}

export async function validateLandingDependencies(
  db: D1Database,
  input: LandingInput,
): Promise<{ ok: true } | { ok: false; field: string; code: string; message: string }> {
  const product = await db
    .prepare(
      `SELECT p.id,p.status,p.deleted_at,s.deleted_at AS section_deleted_at,s.is_enabled AS section_enabled FROM products p JOIN sections s ON s.id=p.section_id WHERE p.id=?`,
    )
    .bind(input.productId)
    .first<{
      id: string;
      status: ProductStatus;
      deleted_at: string | null;
      section_deleted_at: string | null;
      section_enabled: number;
    }>();
  if (!product || product.deleted_at)
    return {
      ok: false,
      field: 'productId',
      code: 'LANDING_PRODUCT_INVALID',
      message: '来源产品不存在或已删除。',
    };
  if (product.section_deleted_at || product.section_enabled !== 1)
    return {
      ok: false,
      field: 'productId',
      code: 'LANDING_SECTION_INVALID',
      message: '来源产品所在分区无效。',
    };
  if (input.status === 'published' && product.status !== 'published')
    return {
      ok: false,
      field: 'status',
      code: 'LANDING_PRODUCT_NOT_PUBLISHED',
      message: '落地页发布前，来源产品必须已发布。',
    };
  if (input.heroAssetId) {
    const asset = await db
      .prepare(
        `SELECT id FROM media_assets WHERE id=? AND status='ready' AND deleted_at IS NULL AND mime_type LIKE 'image/%'`,
      )
      .bind(input.heroAssetId)
      .first<{ id: string }>();
    if (!asset)
      return {
        ok: false,
        field: 'heroAssetId',
        code: 'LANDING_HERO_ASSET_INVALID',
        message: 'Hero 素材不存在、已删除或不是可用图片。',
      };
  }
  return { ok: true };
}

export async function buildLandingModel(
  db: D1Database,
  landing: LandingRecord,
): Promise<LandingBuildModel | null> {
  const productRow = await db
    .prepare(`SELECT section_id FROM products WHERE id=? AND deleted_at IS NULL`)
    .bind(landing.productId)
    .first<{ section_id: string }>();
  if (!productRow) return null;
  const product = await getProduct(db, productRow.section_id, landing.productId);
  if (!product) return null;
  const heroAssetId = landing.heroAssetId ?? product.effectiveCoverAssetId;
  let heroAsset: LandingHeroAsset | null = null;
  if (heroAssetId) {
    const asset = await db
      .prepare(
        `SELECT id,object_key,width,height FROM media_assets WHERE id=? AND status='ready' AND deleted_at IS NULL`,
      )
      .bind(heroAssetId)
      .first<{
        id: string;
        object_key: string;
        width: number | null;
        height: number | null;
      }>();
    if (asset) {
      heroAsset = {
        assetId: asset.id,
        objectKey: asset.object_key,
        publicUrl: buildAssetPublicUrl(await getMediaBaseUrl(db), asset.object_key),
        width: asset.width,
        height: asset.height,
      };
    }
  }
  return {
    landing,
    product,
    resolved: {
      ...resolveLandingPresentation(landing, product, heroAsset),
      chatWelcome: landing.chatWelcomeOverride,
    },
    templateKey: landing.templateKey,
    chatTemplateKey: landing.chatTemplateKey,
  };
}
