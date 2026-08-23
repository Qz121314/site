import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'apps/storefront/dist');
const INDEX_HTML = path.join(DIST, 'index.html');

const BUDGETS = {
  script: 100 * 1024,
  stylesheet: 25 * 1024,
};

function assetPathFromUrl(url) {
  const clean = url.split(/[?#]/, 1)[0];
  if (!clean) throw new Error(`Invalid storefront asset URL: ${url}`);
  return path.join(DIST, clean.replace(/^\//, ''));
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

async function readGzipSize(assetPath) {
  const source = await readFile(assetPath);
  return {
    raw: source.byteLength,
    gzip: gzipSync(source, { level: 9 }).byteLength,
  };
}

async function main() {
  await stat(INDEX_HTML);
  const html = await readFile(INDEX_HTML, 'utf8');
  const scriptMatch = html.match(
    /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*>/i,
  );
  const stylesheetMatches = [
    ...html.matchAll(
      /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi,
    ),
  ];

  if (!scriptMatch?.[1]) {
    throw new Error('Could not locate the Storefront entry module in dist/index.html.');
  }
  if (stylesheetMatches.length === 0) {
    throw new Error(
      'Could not locate the Storefront entry stylesheet in dist/index.html.',
    );
  }

  const checks = [
    {
      label: 'Storefront entry JS',
      url: scriptMatch[1],
      budget: BUDGETS.script,
    },
    ...stylesheetMatches.map((match, index) => ({
      label: `Storefront entry CSS${stylesheetMatches.length > 1 ? ` #${index + 1}` : ''}`,
      url: match[1],
      budget: BUDGETS.stylesheet,
    })),
  ];

  let failed = false;
  for (const check of checks) {
    const size = await readGzipSize(assetPathFromUrl(check.url));
    const withinBudget = size.gzip <= check.budget;
    console.log(
      `${withinBudget ? 'PASS' : 'FAIL'} ${check.label}: ${formatKiB(size.gzip)} gzip / ${formatKiB(size.raw)} raw (budget ${formatKiB(check.budget)} gzip)`,
    );
    failed ||= !withinBudget;
  }

  if (failed) {
    console.error(
      'Storefront bundle budget exceeded. Keep the initial app shell lean or raise a budget only with an explicit performance review.',
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
