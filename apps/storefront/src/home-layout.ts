import type { HomeLayout } from './content';

export type { HomeLayout } from './content';

function resolveIds(
  configuredIds: string[] | undefined,
  fallbackIds: string[],
  publishedSectionIds: ReadonlySet<string>,
  max: number,
): string[] {
  const configured = (configuredIds ?? []).filter((id) => publishedSectionIds.has(id));
  if (configured.length > 0) return configured.slice(0, max);
  return fallbackIds.filter((id) => publishedSectionIds.has(id)).slice(0, max);
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
      3,
    ),
  };
}
