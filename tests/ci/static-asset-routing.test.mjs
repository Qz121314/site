import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function loadWranglerConfig() {
  const source = await readFile(path.join(root, 'wrangler.jsonc'), 'utf8');
  return JSON.parse(source.replace(/^\s*\/\/.*$/gmu, '').replace(/,\s*([}\]])/gu, '$1'));
}

function matchesWorkerFirstPath(pattern, pathname) {
  const expression = pattern
    .split('*')
    .map((part) => part.replace(/[|\\{}()[\]^$+?.]/gu, '\\$&'))
    .join('.*');
  return new RegExp(`^${expression}$`, 'u').test(pathname);
}

test('Static Assets bypass the Worker while the explicit dynamic route contract remains Worker-first', async () => {
  const config = await loadWranglerConfig();
  const workerFirst = config.assets.run_worker_first;

  assert.ok(Array.isArray(workerFirst));
  assert.notEqual(workerFirst, true);
  assert.deepEqual(workerFirst, [
    '/api/*',
    '/go/*',
    '/pages/*',
    '/public/*',
    '/_media/*',
    '/_image/*',
    '/manifest.webmanifest',
    '/robots.txt',
    '/sitemap.xml',
    '/',
    '/browse*',
    '/discover*',
    '/messages*',
    '/faq*',
    '/sections/*',
    '/products/*',
  ]);

  for (const staticPath of [
    '/assets/storefront.js',
    '/assets/storefront.css',
    '/icons/app-icon-512.png',
    '/favicon.ico',
    '/admin/',
    '/admin/assets/admin.js',
  ]) {
    assert.equal(
      workerFirst.some((pattern) => matchesWorkerFirstPath(pattern, staticPath)),
      false,
    );
  }

  for (const dynamicPath of [
    '/api/health',
    '/go/product-1',
    '/public/current.json',
    '/_media/products/cover.webp',
    '/_image/square/640/products/cover.webp',
    '/sections/escorts/products/los-angeles/',
  ]) {
    assert.equal(
      workerFirst.some((pattern) => matchesWorkerFirstPath(pattern, dynamicPath)),
      true,
    );
  }
});

test('Worker source does not emit success-request logs and preserves failed-request diagnostics', async () => {
  const source = await readFile(path.join(root, 'apps/worker/src/index.ts'), 'utf8');

  assert.doesNotMatch(source, /request\.complete/u);
  assert.match(source, /event: 'request\.failed'/u);
  assert.match(source, /console\.error/u);
});
