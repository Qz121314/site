import type { HomeLayout } from './content';

export type { HomeLayout } from './content';

export type ResolvedHomeShortcuts = {
  sectionIds: string[];
  showMore: boolean;
};

function publishedIds(ids: string[], publishedSectionIds: ReadonlySet<string>): string[] {
  return ids.filter((id) => publishedSectionIds.has(id));
}

function resolveIds(
  configuredIds: string[] | undefined,
  fallbackIds: string[],
  publishedSectionIds: ReadonlySet<string>,
  max?: number,
): string[] {
  const configured = publishedIds(configuredIds ?? [], publishedSectionIds);
  const source =
    configured.length > 0 ? configured : publishedIds(fallbackIds, publishedSectionIds);
  return max === undefined ? source : source.slice(0, max);
}

export function resolveHomeShortcuts(
  configuredIds: string[] | undefined,
  fallbackIds: string[],
  publishedSectionIds: ReadonlySet<string>,
): ResolvedHomeShortcuts {
  const configured = publishedIds(configuredIds ?? [], publishedSectionIds);
  const source =
    configured.length > 0 ? configured : publishedIds(fallbackIds, publishedSectionIds);
  const showMore = source.length > 8;
  return {
    sectionIds: source.slice(0, showMore ? 7 : 8),
    showMore,
  };
}

export function resolveHomeLayout(
  configured: HomeLayout | null | undefined,
  fallback: HomeLayout,
  publishedSectionIds: ReadonlySet<string>,
): HomeLayout {
  return {
    shortcutSectionIds: resolveIds(
      configured?.shortcutSectionIds,
      fallback.shortcutSectionIds,
      publishedSectionIds,
      7,
    ),
    recommendationSectionIds: resolveIds(
      configured?.recommendationSectionIds,
      fallback.recommendationSectionIds,
      publishedSectionIds,
    ),
  };
}
