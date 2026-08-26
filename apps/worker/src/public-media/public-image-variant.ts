import {
  isPublicMediaAsset,
  publicMediaFallbackObjectKey,
} from './public-media-fallback';

export const PUBLIC_IMAGE_VARIANT_WIDTHS = [96, 160, 240, 320, 384, 640, 960] as const;

export type PublicImageVariant = {
  objectKey: string;
  width: (typeof PUBLIC_IMAGE_VARIANT_WIDTHS)[number];
};

const WIDTHS = new Set<number>(PUBLIC_IMAGE_VARIANT_WIDTHS);

export function publicImageVariantRequest(pathname: string): PublicImageVariant | null {
  const prefix = '/_image/square/';
  if (!pathname.startsWith(prefix)) return null;
  const remainder = pathname.slice(prefix.length);
  const separator = remainder.indexOf('/');
  if (separator <= 0) return null;
  const width = Number(remainder.slice(0, separator));
  if (!Number.isInteger(width) || !WIDTHS.has(width)) return null;
  const objectKey = publicMediaFallbackObjectKey(remainder.slice(separator + 1));
  return objectKey
    ? {
        objectKey,
        width: width as PublicImageVariant['width'],
      }
    : null;
}

export async function resolvePublicImageVariant(
  db: D1Database,
  pathname: string,
): Promise<PublicImageVariant | null> {
  const variant = publicImageVariantRequest(pathname);
  if (!variant || !(await isPublicMediaAsset(db, variant.objectKey))) return null;
  return variant;
}
