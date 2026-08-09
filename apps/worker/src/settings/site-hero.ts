import { buildAssetPublicUrl } from '../assets/asset-library';

export type SiteHeroMediaKind = 'image' | 'animated_image' | 'video';

export type SiteHeroSlideInput = {
  id: string;
  mediaAssetId: string;
  title: string | null;
  description: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  sortOrder: number;
};

export type SiteHeroSlide = SiteHeroSlideInput & {
  mediaKind: SiteHeroMediaKind;
  mediaUrl: string | null;
};

type HeroSlideRow = {
  id: string;
  media_asset_id: string;
  media_kind: SiteHeroMediaKind;
  object_key: string;
  title: string | null;
  description: string | null;
  cta_label: string | null;
  cta_href: string | null;
  sort_order: number;
};

export type ReadyHeroMediaAsset = {
  id: string;
  object_key: string;
  media_kind: SiteHeroMediaKind;
};

type ValidationSuccess = {
  ok: true;
  provided: boolean;
  value: SiteHeroSlideInput[];
};

type ValidationFailure = {
  ok: false;
  field: string;
  message: string;
};

export type HeroSlidesValidation = ValidationSuccess | ValidationFailure;

const HERO_SLIDE_LIMIT = 10;
const ID_PATTERN = /^[A-Za-z0-9-]{1,100}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown, field: string, maxLength: number): { ok: true; value: string | null } | ValidationFailure {
  if (value === null || value === undefined || value === '') return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, field, message: '必须填写文本。' };
  const normalized = value.trim();
  if (!normalized) return { ok: true, value: null };
  if (normalized.length > maxLength) {
    return { ok: false, field, message: `不能超过 ${maxLength} 个字符。` };
  }
  return { ok: true, value: normalized };
}

function validCtaHref(value: string): boolean {
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function validateHeroSlidesInput(value: unknown): HeroSlidesValidation {
  if (value === undefined) return { ok: true, provided: false, value: [] };
  if (!Array.isArray(value)) {
    return { ok: false, field: 'heroSlides', message: 'Hero 素材列表数据无效。' };
  }
  if (value.length > HERO_SLIDE_LIMIT) {
    return { ok: false, field: 'heroSlides', message: `Hero 最多配置 ${HERO_SLIDE_LIMIT} 个素材。` };
  }

  const ids = new Set<string>();
  const mediaIds = new Set<string>();
  const sortOrders = new Set<number>();
  const slides: SiteHeroSlideInput[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index];
    const fieldPrefix = `heroSlides.${index}`;
    if (!isRecord(raw)) {
      return { ok: false, field: fieldPrefix, message: 'Hero 素材数据无效。' };
    }
    if (typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) {
      return { ok: false, field: `${fieldPrefix}.id`, message: 'Hero 素材标识无效。' };
    }
    if (typeof raw.mediaAssetId !== 'string' || !ID_PATTERN.test(raw.mediaAssetId)) {
      return { ok: false, field: `${fieldPrefix}.mediaAssetId`, message: '请选择有效的 Hero 素材。' };
    }
    if (
      typeof raw.sortOrder !== 'number' ||
      !Number.isInteger(raw.sortOrder) ||
      raw.sortOrder < 0 ||
      raw.sortOrder > 10000
    ) {
      return { ok: false, field: `${fieldPrefix}.sortOrder`, message: 'Hero 排序值无效。' };
    }
    if (ids.has(raw.id)) {
      return { ok: false, field: `${fieldPrefix}.id`, message: 'Hero 素材标识不能重复。' };
    }
    if (mediaIds.has(raw.mediaAssetId)) {
      return { ok: false, field: `${fieldPrefix}.mediaAssetId`, message: '同一个素材不能重复添加到 Hero。' };
    }
    if (sortOrders.has(raw.sortOrder)) {
      return { ok: false, field: `${fieldPrefix}.sortOrder`, message: 'Hero 素材排序不能重复。' };
    }

    const title = optionalText(raw.title, `${fieldPrefix}.title`, 120);
    if (!title.ok) return title;
    const description = optionalText(raw.description, `${fieldPrefix}.description`, 500);
    if (!description.ok) return description;
    const ctaLabel = optionalText(raw.ctaLabel, `${fieldPrefix}.ctaLabel`, 80);
    if (!ctaLabel.ok) return ctaLabel;
    const ctaHref = optionalText(raw.ctaHref, `${fieldPrefix}.ctaHref`, 500);
    if (!ctaHref.ok) return ctaHref;

    if (Boolean(ctaLabel.value) !== Boolean(ctaHref.value)) {
      return {
        ok: false,
        field: `${fieldPrefix}.cta`,
        message: 'Hero 按钮文案和跳转地址必须同时填写或同时留空。',
      };
    }
    if (ctaHref.value && !validCtaHref(ctaHref.value)) {
      return {
        ok: false,
        field: `${fieldPrefix}.ctaHref`,
        message: 'Hero 跳转地址必须是站内路径或 HTTPS 地址。',
      };
    }

    ids.add(raw.id);
    mediaIds.add(raw.mediaAssetId);
    sortOrders.add(raw.sortOrder);
    slides.push({
      id: raw.id,
      mediaAssetId: raw.mediaAssetId,
      title: title.value,
      description: description.value,
      ctaLabel: ctaLabel.value,
      ctaHref: ctaHref.value,
      sortOrder: raw.sortOrder,
    });
  }

  slides.sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  return { ok: true, provided: true, value: slides };
}

export async function getSiteHeroSlides(db: D1Database, mediaBaseUrl: string | null): Promise<SiteHeroSlide[]> {
  const rows = (
    await db
      .prepare(
        `SELECT
           hs.id,
           hs.media_asset_id,
           ma.media_kind,
           ma.object_key,
           hs.title,
           hs.description,
           hs.cta_label,
           hs.cta_href,
           hs.sort_order
         FROM site_hero_slides hs
         JOIN media_assets ma
           ON ma.id = hs.media_asset_id
          AND ma.status = 'ready'
          AND ma.deleted_at IS NULL
         ORDER BY hs.sort_order ASC, hs.id ASC`,
      )
      .all<HeroSlideRow>()
  ).results;

  return rows.map((row) => ({
    id: row.id,
    mediaAssetId: row.media_asset_id,
    mediaKind: row.media_kind,
    mediaUrl: buildAssetPublicUrl(mediaBaseUrl, row.object_key),
    title: row.title,
    description: row.description,
    ctaLabel: row.cta_label,
    ctaHref: row.cta_href,
    sortOrder: row.sort_order,
  }));
}

export async function getReadyHeroMediaAssets(
  db: D1Database,
  ids: string[],
): Promise<Map<string, ReadyHeroMediaAsset>> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return new Map();
  const placeholders = uniqueIds.map(() => '?').join(', ');
  const rows = (
    await db
      .prepare(
        `SELECT id, object_key, media_kind
         FROM media_assets
         WHERE id IN (${placeholders})
           AND status = 'ready'
           AND deleted_at IS NULL
           AND media_kind IN ('image', 'animated_image', 'video')`,
      )
      .bind(...uniqueIds)
      .all<ReadyHeroMediaAsset>()
  ).results;
  return new Map(rows.map((row) => [row.id, row]));
}

export function createReplaceHeroSlideStatements(
  db: D1Database,
  slides: SiteHeroSlideInput[],
  updatedAt: string,
): D1PreparedStatement[] {
  return [
    db.prepare('DELETE FROM site_hero_slides'),
    ...slides.map((slide) =>
      db
        .prepare(
          `INSERT INTO site_hero_slides (
             id, media_asset_id, title, description, cta_label, cta_href, sort_order, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          slide.id,
          slide.mediaAssetId,
          slide.title,
          slide.description,
          slide.ctaLabel,
          slide.ctaHref,
          slide.sortOrder,
          updatedAt,
        ),
    ),
  ];
}

export function resolveHeroSlides(
  slides: SiteHeroSlideInput[],
  assets: Map<string, ReadyHeroMediaAsset>,
  mediaBaseUrl: string | null,
): SiteHeroSlide[] {
  return slides.map((slide) => {
    const media = assets.get(slide.mediaAssetId);
    if (!media) throw new Error('HERO_MEDIA_MISSING');
    return {
      ...slide,
      mediaKind: media.media_kind,
      mediaUrl: buildAssetPublicUrl(mediaBaseUrl, media.object_key),
    };
  });
}
