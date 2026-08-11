export type HomeLayout = {
  shortcutSectionIds: string[];
  recommendationSectionIds: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSectionIds(value: unknown, max: number): string[] {
  if (!Array.isArray(value) || value.length > max) {
    throw new Error('HOME_LAYOUT_INVALID');
  }
  const output: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || !item || seen.has(item)) {
      throw new Error('HOME_LAYOUT_INVALID');
    }
    seen.add(item);
    output.push(item);
  }
  return output;
}

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

export async function loadHomeLayout(
  expectedPointerVersion: string,
  signal?: AbortSignal,
): Promise<HomeLayout | null> {
  const init: RequestInit = {
    method: 'GET',
    cache: 'no-cache',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  };
  if (signal) init.signal = signal;

  const response = await fetch('/api/public/home-layout/', init);
  if (!response.ok) throw new Error('HOME_LAYOUT_UNAVAILABLE');
  const body = (await response.json()) as unknown;
  if (!isRecord(body) || !isRecord(body.layout)) throw new Error('HOME_LAYOUT_INVALID');
  if (body.pointerVersion !== expectedPointerVersion) return null;

  return {
    shortcutSectionIds: parseSectionIds(body.layout.shortcutSectionIds, 7),
    recommendationSectionIds: parseSectionIds(body.layout.recommendationSectionIds, 3),
  };
}
