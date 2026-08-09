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

export async function loadHomeLayout(signal?: AbortSignal): Promise<HomeLayout> {
  const init: RequestInit = {
    method: 'GET',
    cache: 'no-cache',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  };
  if (signal) init.signal = signal;

  const response = await fetch('/api/public/home-layout/', init);
  if (!response.ok) throw new Error('HOME_LAYOUT_UNAVAILABLE');
  const body = await response.json() as unknown;
  if (!isRecord(body) || !isRecord(body.layout)) throw new Error('HOME_LAYOUT_INVALID');

  return {
    shortcutSectionIds: parseSectionIds(body.layout.shortcutSectionIds, 7),
    recommendationSectionIds: parseSectionIds(body.layout.recommendationSectionIds, 3),
  };
}
