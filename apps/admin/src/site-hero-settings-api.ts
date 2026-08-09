import {
  AdminApiError,
  fetchSiteSettings,
  updateSiteSettings,
  type SiteSettings,
  type SiteSettingsUpdateInput,
} from './api';
import type { MediaKind } from './asset-library/api';
import { parseStorefrontCopy, type StorefrontCopy } from './storefront-copy-settings';

export type SiteHeroSlide = {
  id: string;
  mediaAssetId: string;
  mediaKind: MediaKind;
  mediaUrl: string | null;
  title: string | null;
  description: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  sortOrder: number;
};

export type SiteHeroSlideInput = Omit<SiteHeroSlide, 'mediaKind' | 'mediaUrl'>;

export type SiteSettingsWithHero = SiteSettings & {
  storefrontCopy: StorefrontCopy;
  heroSlides: SiteHeroSlide[];
};

export type SiteSettingsWithHeroUpdateInput = SiteSettingsUpdateInput & {
  logoAssetId: string | null;
  storefrontCopy: StorefrontCopy;
  heroSlides: SiteHeroSlideInput[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseHeroSlide(value: unknown): SiteHeroSlide {
  if (!isRecord(value)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'Hero 设置返回数据无效。');
  }
  const valid =
    typeof value.id === 'string' &&
    typeof value.mediaAssetId === 'string' &&
    (value.mediaKind === 'image' || value.mediaKind === 'animated_image' || value.mediaKind === 'video') &&
    (typeof value.mediaUrl === 'string' || value.mediaUrl === null) &&
    (typeof value.title === 'string' || value.title === null) &&
    (typeof value.description === 'string' || value.description === null) &&
    (typeof value.ctaLabel === 'string' || value.ctaLabel === null) &&
    (typeof value.ctaHref === 'string' || value.ctaHref === null) &&
    typeof value.sortOrder === 'number';
  if (!valid) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'Hero 设置返回数据无效。');
  }
  return value as SiteHeroSlide;
}

function withHero(settings: SiteSettings): SiteSettingsWithHero {
  const raw = settings as SiteSettings & { heroSlides?: unknown; storefrontCopy?: unknown };
  if (!Array.isArray(raw.heroSlides)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'Hero 设置返回数据无效。');
  }
  return {
    ...settings,
    storefrontCopy: parseStorefrontCopy(raw.storefrontCopy),
    heroSlides: raw.heroSlides.map(parseHeroSlide),
  };
}

export async function fetchSiteSettingsWithHero(): Promise<SiteSettingsWithHero> {
  return withHero(await fetchSiteSettings());
}

export async function updateSiteSettingsWithHero(
  input: SiteSettingsWithHeroUpdateInput,
): Promise<SiteSettingsWithHero> {
  return withHero(await updateSiteSettings(input));
}
