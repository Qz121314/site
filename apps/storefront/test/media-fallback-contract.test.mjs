import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { sameOriginMediaFallbackUrl } from '../src/media-fallback.ts';

const resilientMediaSource = await readFile(
  new URL('../src/ResilientMedia.tsx', import.meta.url),
  'utf8',
);
const navigationSource = await readFile(
  new URL('../src/storefront-navigation.tsx', import.meta.url),
  'utf8',
);
const supportSource = await readFile(
  new URL('../src/support-ui.tsx', import.meta.url),
  'utf8',
);

test('dynamic R2 URLs derive a same-origin media fallback without hardcoded domains', () => {
  assert.equal(
    sameOriginMediaFallbackUrl(
      'https://media.example.com/media/asset-1/optimized/cover.webp',
      'https://app.example.com',
    ),
    'https://app.example.com/_media/media/asset-1/optimized/cover.webp',
  );
  assert.equal(
    sameOriginMediaFallbackUrl(
      'https://new-media.example.com/branding/logo/2026/logo.webp',
      'https://app.example.com',
    ),
    'https://app.example.com/_media/branding/logo/2026/logo.webp',
  );
  assert.equal(
    sameOriginMediaFallbackUrl(
      'https://app.example.com/media/cover.webp',
      'https://app.example.com',
    ),
    null,
  );
});

test('images and videos retry through the same-origin media route before placeholders', () => {
  assert.match(resilientMediaSource, /sameOriginMediaFallbackUrl/u);
  assert.match(resilientMediaSource, /setRetry\(\{ source: src, url: retryUrl \}\)/u);
  assert.match(navigationSource, /<ResilientImage/u);
  assert.match(supportSource, /productCoverUrl[\s\S]*?<ResilientImage/u);
});
