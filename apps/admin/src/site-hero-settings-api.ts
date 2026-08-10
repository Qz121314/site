import {
  AdminApiError,
  fetchSiteSettings,
  updateSiteSettings,
  type SiteSettings,
  type SiteSettingsUpdateInput,
} from './api';
import type { MediaKind } from './asset-library/api';

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

export type BottomNavigationKey = 'home' | 'browse' | 'messages' | 'faq';
export type BottomNavigationIconType = 'builtin' | 'emoji' | 'asset';
export type BottomNavigationItem = {
  key: BottomNavigationKey;
  label: string;
  iconType: BottomNavigationIconType;
  iconValue: string | null;
  iconAssetId: string | null;
  enabled: boolean;
  sortOrder: number;
};
export type BottomNavigationItemInput = Omit<BottomNavigationItem, 'sortOrder'>;

export type HomeLayout = {
  shortcutSectionIds: string[];
  recommendationSectionIds: string[];
};

export type SiteSettingsWithHero = SiteSettings & {
  heroSlides: SiteHeroSlide[];
  bottomNavigation: BottomNavigationItem[];
  homeLayout: HomeLayout;
};

export type SiteSettingsWithHeroUpdateInput = SiteSettingsUpdateInput & {
  logoAssetId: string | null;
  heroSlides: SiteHeroSlideInput[];
  bottomNavigation: BottomNavigationItemInput[];
  homeLayout: HomeLayout;
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

function parseBottomNavigationItem(value: unknown): BottomNavigationItem {
  if (!isRecord(value)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '底部导航返回数据无效。');
  }
  const valid =
    (value.key === 'home' || value.key === 'browse' || value.key === 'messages' || value.key === 'faq') &&
    typeof value.label === 'string' &&
    (value.iconType === 'builtin' || value.iconType === 'emoji' || value.iconType === 'asset') &&
    (typeof value.iconValue === 'string' || value.iconValue === null) &&
    (typeof value.iconAssetId === 'string' || value.iconAssetId === null) &&
    typeof value.enabled === 'boolean' &&
    typeof value.sortOrder === 'number';
  if (!valid) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '底部导航返回数据无效。');
  }
  return value as BottomNavigationItem;
}

function parseSectionIds(value: unknown, max: number): string[] {
  if (
    !Array.isArray(value) ||
    value.length > max ||
    !value.every((item) => typeof item === 'string' && item.length > 0) ||
    new Set(value).size !== value.length
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '首页布局返回数据无效。');
  }
  return value as string[];
}

function parseHomeLayout(value: unknown): HomeLayout {
  if (!isRecord(value)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '首页布局返回数据无效。');
  }
  return {
    shortcutSectionIds: parseSectionIds(value.shortcutSectionIds, 7),
    recommendationSectionIds: parseSectionIds(value.recommendationSectionIds, 3),
  };
}

function withHero(settings: SiteSettings): SiteSettingsWithHero {
  const raw = settings as SiteSettings & {
    heroSlides?: unknown;
    bottomNavigation?: unknown;
    homeLayout?: unknown;
  };
  if (!Array.isArray(raw.heroSlides)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'Hero 设置返回数据无效。');
  }
  if (!Array.isArray(raw.bottomNavigation)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', '底部导航返回数据无效。');
  }
  return {
    ...settings,
    heroSlides: raw.heroSlides.map(parseHeroSlide),
    bottomNavigation: raw.bottomNavigation.map(parseBottomNavigationItem),
    homeLayout: parseHomeLayout(raw.homeLayout),
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
