import assert from 'node:assert/strict';
import test from 'node:test';
import { validateHeroSlidesInput } from '../src/settings/site-hero.ts';

function slide(overrides = {}) {
  return {
    id: 'slide-1',
    mediaAssetId: 'media-1',
    title: null,
    description: null,
    ctaLabel: null,
    ctaHref: null,
    sortOrder: 0,
    ...overrides,
  };
}

test('hero settings are optional and an empty list means no hero', () => {
  assert.deepEqual(validateHeroSlidesInput(undefined), {
    ok: true,
    provided: false,
    value: [],
  });
  assert.deepEqual(validateHeroSlidesInput([]), {
    ok: true,
    provided: true,
    value: [],
  });
});

test('hero slides accept backend copy, internal CTA paths and HTTPS destinations', () => {
  const internal = validateHeroSlidesInput([
    slide({
      title: '  Summer launch  ',
      description: '  Backend managed copy  ',
      ctaLabel: 'Open',
      ctaHref: '/products/demo',
    }),
  ]);
  assert.equal(internal.ok, true);
  assert.equal(internal.value[0].title, 'Summer launch');
  assert.equal(internal.value[0].description, 'Backend managed copy');
  assert.equal(internal.value[0].ctaHref, '/products/demo');

  const external = validateHeroSlidesInput([
    slide({ ctaLabel: 'Visit', ctaHref: 'https://example.com/path' }),
  ]);
  assert.equal(external.ok, true);
});

test('hero CTA label and destination must be configured together', () => {
  const missingHref = validateHeroSlidesInput([
    slide({ ctaLabel: 'Open', ctaHref: null }),
  ]);
  assert.equal(missingHref.ok, false);
  assert.equal(missingHref.field, 'heroSlides.0.cta');

  const unsafeHref = validateHeroSlidesInput([
    slide({ ctaLabel: 'Open', ctaHref: 'javascript:alert(1)' }),
  ]);
  assert.equal(unsafeHref.ok, false);
  assert.equal(unsafeHref.field, 'heroSlides.0.ctaHref');
});

test('hero slides reject duplicate media and duplicate order positions', () => {
  const duplicateMedia = validateHeroSlidesInput([
    slide(),
    slide({ id: 'slide-2', sortOrder: 1 }),
  ]);
  assert.equal(duplicateMedia.ok, false);
  assert.equal(duplicateMedia.field, 'heroSlides.1.mediaAssetId');

  const duplicateOrder = validateHeroSlidesInput([
    slide(),
    slide({ id: 'slide-2', mediaAssetId: 'media-2' }),
  ]);
  assert.equal(duplicateOrder.ok, false);
  assert.equal(duplicateOrder.field, 'heroSlides.1.sortOrder');
});

test('hero settings cap the carousel at ten slides', () => {
  const slides = Array.from({ length: 11 }, (_, index) => slide({
    id: `slide-${index}`,
    mediaAssetId: `media-${index}`,
    sortOrder: index,
  }));
  const result = validateHeroSlidesInput(slides);
  assert.equal(result.ok, false);
  assert.equal(result.field, 'heroSlides');
});
