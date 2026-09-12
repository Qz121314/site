export const storefrontLayoutPages = [
  'home',
  'browse',
  'section',
  'product',
  'article',
  'messages',
] as const;

export type StorefrontLayoutPage = (typeof storefrontLayoutPages)[number];
export type StorefrontLayoutKey = 'current' | 'template-a';

export type StorefrontLayoutConfig = Record<StorefrontLayoutPage, StorefrontLayoutKey>;

export const defaultStorefrontLayoutConfig: StorefrontLayoutConfig = {
  home: 'current',
  browse: 'current',
  section: 'current',
  product: 'current',
  article: 'current',
  messages: 'current',
};

export function resolveStorefrontLayoutConfig(value: unknown): StorefrontLayoutConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...defaultStorefrontLayoutConfig };
  }

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    storefrontLayoutPages.map((page) => [
      page,
      record[page] === 'current' || record[page] === 'template-a'
        ? record[page]
        : defaultStorefrontLayoutConfig[page],
    ]),
  ) as StorefrontLayoutConfig;
}
