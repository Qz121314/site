import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const mainWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const storefrontTransport = readFileSync(
  'apps/storefront/src/public-content-transport.ts',
  'utf8',
);

test('production release uses Admin-published runtime CDN origin discovery', () => {
  assert.doesNotMatch(mainWorkflow, /VITE_PUBLIC_CONTENT_ORIGIN/);
  assert.doesNotMatch(mainWorkflow, /validate-public-content-origin/);
  assert.doesNotMatch(
    storefrontTransport,
    /import\.meta\.env\.VITE_PUBLIC_CONTENT_ORIGIN/,
    'production Storefront must not depend on a duplicate build-time CDN origin',
  );
});
