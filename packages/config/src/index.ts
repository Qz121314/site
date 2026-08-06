import type { Locale } from '@site/shared';

export const routes = {
  storefront: {
    en: '/en/',
    es: '/es/',
  } satisfies Record<Locale, string>,
  admin: '/admin/',
  health: '/api/health',
} as const;

export const mediaRules = {
  listingCoverAspectRatio: '16/10',
  maxGalleryItems: 12,
  preferredFormats: ['avif', 'webp'] as const,
} as const;
