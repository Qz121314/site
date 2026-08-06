export * from './domain';

export const supportedLocales = ['en', 'es'] as const;

export type Locale = (typeof supportedLocales)[number];

export function isLocale(value: string | undefined): value is Locale {
  return supportedLocales.includes(value as Locale);
}

export function resolveLocale(pathname: string): Locale {
  const candidate = pathname.split('/').filter(Boolean)[0];
  return isLocale(candidate) ? candidate : 'en';
}

export const appVersion = '0.1.0';
