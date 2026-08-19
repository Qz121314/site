export type BottomNavigationKey = 'home' | 'browse' | 'messages' | 'faq';
export type BottomNavigationBuiltinIcon =
  | 'home'
  | 'compass'
  | 'messages'
  | 'help'
  | 'grid'
  | 'search'
  | 'star'
  | 'heart'
  | 'user'
  | 'menu'
  | 'bell'
  | 'map';

export type BottomNavigationItemConfig = {
  key: BottomNavigationKey;
  label: string;
  enabled: boolean;
  icon: {
    type: 'builtin' | 'emoji' | 'image';
    value: string | null;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKey(value: unknown): value is BottomNavigationKey {
  return (
    value === 'home' || value === 'browse' || value === 'messages' || value === 'faq'
  );
}

function parseItem(value: unknown): BottomNavigationItemConfig | null {
  if (
    !isRecord(value) ||
    !isKey(value.key) ||
    typeof value.label !== 'string' ||
    typeof value.enabled !== 'boolean'
  ) {
    return null;
  }
  if (!isRecord(value.icon)) return null;
  if (
    value.icon.type !== 'builtin' &&
    value.icon.type !== 'emoji' &&
    value.icon.type !== 'image'
  )
    return null;
  if (typeof value.icon.value !== 'string' && value.icon.value !== null) return null;
  return {
    key: value.key,
    label: value.label,
    enabled: value.enabled,
    icon: { type: value.icon.type, value: value.icon.value },
  };
}

export function parseBottomNavigationItems(value: unknown): BottomNavigationItemConfig[] {
  if (!Array.isArray(value)) throw new Error('BOTTOM_NAVIGATION_INVALID');
  const items = value.map(parseItem);
  if (items.some((item) => item === null)) throw new Error('BOTTOM_NAVIGATION_INVALID');
  const parsed = items as BottomNavigationItemConfig[];
  const keys = new Set(parsed.map((item) => item.key));
  if (parsed.length !== 4 || keys.size !== 4)
    throw new Error('BOTTOM_NAVIGATION_INVALID');
  return parsed;
}

export async function loadBottomNavigation(
  signal?: AbortSignal,
): Promise<BottomNavigationItemConfig[]> {
  const response = await fetch('/api/public/bottom-navigation/', {
    method: 'GET',
    cache: 'no-cache',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error('BOTTOM_NAVIGATION_UNAVAILABLE');
  const body = (await response.json()) as unknown;
  if (!isRecord(body)) throw new Error('BOTTOM_NAVIGATION_INVALID');
  return parseBottomNavigationItems(body.items);
}
