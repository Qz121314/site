import type {
  BottomNavigationItem,
  SiteHeroSlide,
  SiteSettingsWithHero,
  SiteSettingsWithHeroUpdateInput,
} from '../site-hero-settings-api';

function optionalTrimmed(value: string | null): string | null {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}

export function cloneHeroSlides(slides: SiteHeroSlide[]): SiteHeroSlide[] {
  return slides.map((slide) => ({ ...slide }));
}

export function cloneBottomNavigation(
  items: BottomNavigationItem[],
): BottomNavigationItem[] {
  return items.map((item) => ({ ...item }));
}

export function toSiteSettingsUpdateInput(
  settings: SiteSettingsWithHero,
): SiteSettingsWithHeroUpdateInput {
  return {
    siteName: settings.siteName,
    locationLabel: settings.locationLabel,
    logoAssetId: settings.logoAssetId,
    pwaIconAssetId: settings.pwaIconAssetId,
    mediaBaseUrl: settings.mediaBaseUrl,
    ga4MeasurementId: settings.ga4MeasurementId,
    homeSectionLimit: settings.homeSectionLimit,
    showHot: settings.showHot,
    showLatest: settings.showLatest,
    showMore: settings.showMore,
    showFaq: settings.showFaq,
    installPrompt: { ...settings.installPrompt },
    heroSlides: settings.heroSlides.map((slide, index) => ({
      id: slide.id,
      mediaAssetId: slide.mediaAssetId,
      title: optionalTrimmed(slide.title),
      description: optionalTrimmed(slide.description),
      ctaLabel: optionalTrimmed(slide.ctaLabel),
      ctaHref: optionalTrimmed(slide.ctaHref),
      sortOrder: index,
    })),
    bottomNavigation: settings.bottomNavigation.map(
      ({ sortOrder: _sortOrder, ...item }) => ({ ...item }),
    ),
    homeLayout: {
      shortcutSectionIds: [...settings.homeLayout.shortcutSectionIds],
      recommendationSectionIds: [...settings.homeLayout.recommendationSectionIds],
    },
  };
}

export function settingsValueEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
