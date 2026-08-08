import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCompressibleStaticMediaImage,
  MEDIA_IMAGE_COMPRESSION_PROFILE,
} from '../src/asset-library/media-image-compression.ts';

test('static JPG PNG and WebP are routed through browser compression', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.equal(isCompressibleStaticMediaImage({ type }), true, type);
  }
});

test('GIF and video bypass static Canvas compression', () => {
  for (const type of ['image/gif', 'video/mp4', 'video/webm']) {
    assert.equal(isCompressibleStaticMediaImage({ type }), false, type);
  }
});

test('static image compression profile remains explicit', () => {
  assert.equal(MEDIA_IMAGE_COMPRESSION_PROFILE, 'browser-static-image-v1');
});
