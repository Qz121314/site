import assert from 'node:assert/strict';
import test from 'node:test';

import { publicImageVariantRequest } from '../src/public-media/public-image-variant.ts';

test('public image variants accept only fixed square widths and safe object keys', () => {
  assert.deepEqual(
    publicImageVariantRequest('/_image/square/160/media/asset-1/optimized/cover.webp'),
    {
      width: 160,
      objectKey: 'media/asset-1/optimized/cover.webp',
    },
  );
  assert.equal(
    publicImageVariantRequest('/_image/square/161/media/asset/cover.webp'),
    null,
  );
  assert.equal(
    publicImageVariantRequest('/_image/square/160/media/%2E%2E/secret.webp'),
    null,
  );
});
