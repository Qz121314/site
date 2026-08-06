import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const storefrontDist = path.join(root, 'apps', 'storefront', 'dist');
const adminDist = path.join(root, 'apps', 'admin', 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(storefrontDist, dist, { recursive: true });

const storefrontHtml = await readFile(path.join(dist, 'index.html'));
for (const locale of ['en', 'es']) {
  const localeDirectory = path.join(dist, locale);
  await mkdir(localeDirectory, { recursive: true });
  await writeFile(path.join(localeDirectory, 'index.html'), storefrontHtml);
}

await mkdir(path.join(dist, 'admin'), { recursive: true });
await cp(adminDist, path.join(dist, 'admin'), { recursive: true });

await writeFile(
  path.join(dist, '_headers'),
  `/assets/*
  Cache-Control: public, max-age=31536000, immutable

/icons/*
  Cache-Control: public, max-age=31536000, immutable

/en/sw.js
  Cache-Control: no-cache

/es/sw.js
  Cache-Control: no-cache

/admin/assets/*
  Cache-Control: public, max-age=31536000, immutable

/admin/*
  Cache-Control: no-cache
  X-Robots-Tag: noindex, nofollow
`,
);

await writeFile(
  path.join(dist, 'version.json'),
  `${JSON.stringify(
    {
      appVersion: '0.1.0',
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
);

console.log('Assembled Storefront and Admin assets in dist/.');
