export const routes = {
  storefront: '/',
  admin: '/admin/',
  health: '/api/health',
} as const;

export const mediaRules = {
  listingCoverAspectRatio: '16/10',
  maxGalleryItems: 12,
  preferredFormats: ['avif', 'webp'] as const,
} as const;
