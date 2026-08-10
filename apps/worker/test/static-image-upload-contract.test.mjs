import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STATIC_IMAGE_COMPRESSION_PROFILE,
  validateStaticImageUploadContract,
} from '../src/media/static-image-upload-contract.ts';

function validate(overrides = {}) {
  return validateStaticImageUploadContract({
    mimeType: 'image/webp',
    compressionProfile: STATIC_IMAGE_COMPRESSION_PROFILE,
    sourceByteSize: 4_000_000,
    ...overrides,
  });
}

test('compressed WebP output is accepted', () => {
  assert.equal(validate(), null);
});

test('compressed JPEG fallback is accepted', () => {
  assert.equal(validate({ mimeType: 'image/jpeg' }), null);
});

test('PNG cannot be accepted as optimized static output', () => {
  assert.equal(validate({ mimeType: 'image/png' })?.code, 'MEDIA_COMPRESSION_REQUIRED');
});

test('missing compression profile rejects static image', () => {
  assert.equal(
    validate({ compressionProfile: null })?.code,
    'MEDIA_COMPRESSION_REQUIRED',
  );
});

test('invalid original byte size rejects static image', () => {
  assert.equal(validate({ sourceByteSize: 0 })?.code, 'MEDIA_COMPRESSION_REQUIRED');
  assert.equal(validate({ sourceByteSize: null })?.code, 'MEDIA_COMPRESSION_REQUIRED');
});

test('GIF and videos are outside the static image compression contract', () => {
  assert.equal(
    validate({ mimeType: 'image/gif', compressionProfile: null, sourceByteSize: null }),
    null,
  );
  assert.equal(
    validate({ mimeType: 'video/mp4', compressionProfile: null, sourceByteSize: null }),
    null,
  );
});
