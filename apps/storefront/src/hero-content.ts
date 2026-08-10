import type { StorefrontBootstrap } from './content';

export type PublishedHeroSlide = {
  id: string;
  mediaKind: 'image' | 'animated_image' | 'video';
  mediaUrl: string;
  title: string | null;
  description: string | null;
  cta: { label: string; href: string } | null;
};

export type PublishedHero = {
  slides: PublishedHeroSlide[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function encodeObjectKey(key: string): string {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function mediaUrl(baseUrl: string, objectKey: string): string {
  return `${baseUrl}/${encodeObjectKey(objectKey)}`;
}

function parseSlide(value: unknown, baseUrl: string): PublishedHeroSlide | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !isRecord(value.media))
    return null;
  const media = value.media;
  if (
    (media.kind !== 'image' &&
      media.kind !== 'animated_image' &&
      media.kind !== 'video') ||
    typeof media.objectKey !== 'string' ||
    !media.objectKey
  ) {
    return null;
  }
  const title = typeof value.title === 'string' ? value.title : null;
  const description = typeof value.description === 'string' ? value.description : null;
  let cta: PublishedHeroSlide['cta'] = null;
  if (
    isRecord(value.cta) &&
    typeof value.cta.label === 'string' &&
    typeof value.cta.href === 'string'
  ) {
    cta = { label: value.cta.label, href: value.cta.href };
  }
  return {
    id: value.id,
    mediaKind: media.kind,
    mediaUrl: mediaUrl(baseUrl, media.objectKey),
    title,
    description,
    cta,
  };
}

export async function loadPublishedHero(
  bootstrap: StorefrontBootstrap,
  signal?: AbortSignal,
): Promise<PublishedHero | null> {
  if (bootstrap.pointer.schemaVersion !== 2) return null;
  const reference = bootstrap.pointer.site;
  const url = `${bootstrap.origin}/public/modules/site/${encodeURIComponent(reference.contentVersion)}/site.json`;
  const response = await fetch(url, {
    method: 'GET',
    cache: 'force-cache',
    credentials: 'omit',
    headers: { Accept: 'application/json' },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) return null;

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    return null;
  }
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    value.moduleKey !== 'site' ||
    !isRecord(value.site)
  ) {
    return null;
  }
  const hero = value.site.hero;
  if (hero === null || hero === undefined) return null;
  if (!isRecord(hero) || !Array.isArray(hero.slides)) return null;

  const slides = hero.slides
    .map((slide) => parseSlide(slide, bootstrap.site.site.mediaBaseUrl))
    .filter((slide): slide is PublishedHeroSlide => Boolean(slide));
  return slides.length > 0 ? { slides } : null;
}
