import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const storefrontDist = path.join(root, 'apps', 'storefront', 'dist');
const adminDist = path.join(root, 'apps', 'admin', 'dist');
const securityHeaders = JSON.parse(
  await readFile(path.join(root, 'config', 'security-headers.json'), 'utf8'),
);
const staticSecurityHeaderBlock = Object.entries(securityHeaders)
  .map(([name, value]) => `  ${name}: ${value}`)
  .join('\n');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(storefrontDist, dist, { recursive: true });

await mkdir(path.join(dist, 'admin'), { recursive: true });
await cp(adminDist, path.join(dist, 'admin'), { recursive: true });

await writeFile(
  path.join(dist, '_headers'),
  `/*
${staticSecurityHeaderBlock}

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/icons/*
  Cache-Control: public, max-age=31536000, immutable

/sw.js
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
      publicLanguage: 'en',
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
);

console.log('Assembled English Storefront and Chinese Admin assets in dist/.');
