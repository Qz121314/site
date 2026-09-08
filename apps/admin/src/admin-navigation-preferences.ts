import {
  ADMIN_DOMAINS,
  getAdminSecondaryItems,
  type AdminDomain,
  type AdminView,
} from './admin-navigation';
import type { AdminSection } from './api';

export const ADMIN_NAVIGATION_PREFERENCES_STORAGE_KEY =
  'site.admin.navigationPreferences.v1';

export type AdminNavigationPreferences = {
  primary: AdminDomain[];
  secondary: Partial<Record<AdminDomain, AdminView[]>>;
};

export function defaultAdminNavigationPreferences(): AdminNavigationPreferences {
  return { primary: ADMIN_DOMAINS.map((item) => item.id), secondary: {} };
}

function uniqueKnown<T extends string>(values: unknown, known: readonly T[]): T[] {
  if (!Array.isArray(values)) return [];
  const allowed = new Set(known);
  return values.filter(
    (value): value is T => typeof value === 'string' && allowed.has(value as T),
  );
}

function readViewOrder(values: unknown): AdminView[] {
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is AdminView => typeof value === 'string');
}

export function readAdminNavigationPreferences(): AdminNavigationPreferences {
  const fallback = defaultAdminNavigationPreferences();
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = JSON.parse(
      window.localStorage.getItem(ADMIN_NAVIGATION_PREFERENCES_STORAGE_KEY) ?? 'null',
    );
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
    const source = raw as { primary?: unknown; secondary?: unknown };
    const primary = uniqueKnown(source.primary, fallback.primary);
    const secondarySource =
      source.secondary &&
      typeof source.secondary === 'object' &&
      !Array.isArray(source.secondary)
        ? (source.secondary as Record<string, unknown>)
        : {};
    return {
      primary: completeOrder(primary, fallback.primary),
      secondary: Object.fromEntries(
        ADMIN_DOMAINS.map(({ id }) => [id, readViewOrder(secondarySource[id])]),
      ) as AdminNavigationPreferences['secondary'],
    };
  } catch {
    return fallback;
  }
}

export function saveAdminNavigationPreferences(value: AdminNavigationPreferences): void {
  try {
    window.localStorage.setItem(
      ADMIN_NAVIGATION_PREFERENCES_STORAGE_KEY,
      JSON.stringify(value),
    );
  } catch {
    /* preference remains in this session */
  }
}

export function resetAdminNavigationPreferences(): AdminNavigationPreferences {
  const value = defaultAdminNavigationPreferences();
  try {
    window.localStorage.removeItem(ADMIN_NAVIGATION_PREFERENCES_STORAGE_KEY);
  } catch {
    /* no-op */
  }
  return value;
}

export function completeOrder<T>(ordered: readonly T[], defaults: readonly T[]): T[] {
  const result = [...ordered];
  for (const item of defaults) if (!result.includes(item)) result.push(item);
  return result;
}

export function orderedAdminDomains(preferences: AdminNavigationPreferences) {
  return completeOrder(
    preferences.primary,
    ADMIN_DOMAINS.map((item) => item.id),
  )
    .map((id) => ADMIN_DOMAINS.find((item) => item.id === id))
    .filter((item): item is (typeof ADMIN_DOMAINS)[number] => Boolean(item));
}

export function orderedAdminSecondaryItems(
  domain: AdminDomain,
  sections: AdminSection[],
  preferences: AdminNavigationPreferences,
) {
  const defaults = getAdminSecondaryItems(domain, sections);
  const order = completeOrder(
    preferences.secondary[domain] ?? [],
    defaults.map((item) => item.view),
  );
  const index = new Map(order.map((view, position) => [view, position]));
  return [...defaults].sort(
    (a, b) => (index.get(a.view) ?? Infinity) - (index.get(b.view) ?? Infinity),
  );
}
