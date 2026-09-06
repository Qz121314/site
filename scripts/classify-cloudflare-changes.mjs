import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const OUTPUT_KEYS = [
  'migration_changed',
  'worker_changed',
  'storefront_changed',
  'admin_changed',
  'r2_config_changed',
  'wrangler_config_changed',
  'public_runtime_changed',
  'production_browser_relevant',
  'deploy_required',
  'docs_only',
  'd1_remote_required',
  'r2_validation_required',
  'infra_validation_required',
  'deep_smoke_relevant',
  'tests_only',
  'development_tooling_only',
];

const normalizePath = (value) => value.replaceAll('\\', '/').replace(/^\.\//, '');
const matchesAny = (value, patterns) => patterns.some((pattern) => pattern.test(value));

const isDocumentation = (path) =>
  path !== 'AGENTS.md' &&
  (path === 'README.md' ||
    path === 'CHANGELOG.md' ||
    path.startsWith('docs/') ||
    /\.md$/i.test(path));

const isTestPath = (path) =>
  /(^|\/)(?:test|tests|__tests__)\//.test(path) ||
  /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path);

const isDevelopmentTooling = (path) =>
  path === 'AGENTS.md' ||
  path.startsWith('docs/development/') ||
  path === 'docs/development-standards.md' ||
  path.startsWith('.githooks/') ||
  path === 'scripts/dev-preflight.mjs' ||
  path === 'scripts/precommit-check.mjs' ||
  path === 'scripts/fix-changed.mjs' ||
  path === 'scripts/classify-cloudflare-changes.mjs' ||
  path === 'scripts/ensure-wrangler-types.mjs' ||
  path === 'scripts/production-smoke.mjs' ||
  path === 'scripts/production-deep-smoke.mjs' ||
  path.startsWith('tests/ci/') ||
  path.startsWith('.github/workflows/');

const PUBLIC_WORKER_PATTERNS = [
  /^apps\/worker\/src\/routes\/(?:public|storefront|media|articles?)(?:[-/.]|$)/,
  /^apps\/worker\/src\/(?:public|publishing|storefront|media)(?:[-/.]|$)/,
  /^apps\/worker\/src\/(?:index|app)\.[cm]?[jt]s$/,
  /^apps\/worker\/src\/(?:http|security)(?:[-/.]|$)/,
];

const PRODUCTION_BROWSER_CONTRACT_PATTERNS = [
  /^tests\/e2e\/.*production.*\.(?:test|spec)\.[cm]?[jt]s$/,
  /^tests\/e2e\/production-smoke\.spec\.ts$/,
];

export function classifyFiles(inputFiles) {
  const files = [...new Set(inputFiles.map(normalizePath).filter(Boolean))].sort();

  const migrationChanged = files.some((path) => path.startsWith('migrations/'));
  const isRuntimePath = (path) => !isTestPath(path);
  const directStorefrontChanged = files.some(
    (path) => isRuntimePath(path) && path.startsWith('apps/storefront/'),
  );
  const directAdminChanged = files.some(
    (path) => isRuntimePath(path) && path.startsWith('apps/admin/'),
  );
  const directWorkerChanged = files.some(
    (path) => isRuntimePath(path) && path.startsWith('apps/worker/'),
  );
  const storefrontUiChanged = files.some(
    (path) => isRuntimePath(path) && path.startsWith('packages/storefront-ui/'),
  );
  const sharedChanged = files.some(
    (path) => isRuntimePath(path) && path.startsWith('packages/shared/'),
  );
  const configPackageChanged = files.some(
    (path) => isRuntimePath(path) && path.startsWith('packages/config/'),
  );

  const storefrontChanged =
    directStorefrontChanged ||
    storefrontUiChanged ||
    sharedChanged ||
    configPackageChanged;
  const adminChanged = directAdminChanged || sharedChanged || configPackageChanged;
  const workerChanged = directWorkerChanged || sharedChanged || configPackageChanged;

  const wranglerConfigChanged = files.includes('wrangler.jsonc');
  const r2ConfigChanged = files.some(
    (path) =>
      path === 'config/r2-public-cors.json' ||
      /^config\/r2[-/]/.test(path) ||
      path === 'scripts/resolve-r2-public-origin.mjs',
  );

  const publicWorkerChanged = files.some(
    (path) => path.startsWith('apps/worker/') && matchesAny(path, PUBLIC_WORKER_PATTERNS),
  );
  const publicRuntimeChanged = publicWorkerChanged;

  const productionBrowserContractChanged = files.some(
    (path) =>
      path === 'playwright.config.ts' ||
      matchesAny(path, PRODUCTION_BROWSER_CONTRACT_PATTERNS),
  );

  const buildOrReleaseInputChanged = files.some((path) =>
    [
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'tsconfig.base.json',
      'scripts/assemble-assets.mjs',
    ].includes(path),
  );

  const productionConfigChanged = files.some((path) =>
    /^(?:apps\/(?:storefront|admin)\/)?(?:vite|tsconfig).*\.(?:ts|js|mjs|json)$/.test(
      path,
    ),
  );

  const deployRequired =
    migrationChanged ||
    workerChanged ||
    storefrontChanged ||
    adminChanged ||
    wranglerConfigChanged ||
    buildOrReleaseInputChanged ||
    productionConfigChanged;

  const r2ValidationRequired = r2ConfigChanged;
  const infraValidationRequired = r2ConfigChanged || wranglerConfigChanged;
  const productionBrowserRelevant =
    storefrontChanged || publicRuntimeChanged || productionBrowserContractChanged;
  const deepSmokeRelevant =
    storefrontChanged ||
    publicRuntimeChanged ||
    r2ValidationRequired ||
    wranglerConfigChanged;

  const docsOnly = files.length > 0 && files.every(isDocumentation);
  const testsOnly = files.length > 0 && files.every(isTestPath);
  const developmentToolingOnly =
    files.length > 0 &&
    files.every(
      (path) => isDocumentation(path) || isDevelopmentTooling(path) || isTestPath(path),
    );

  return {
    files,
    migration_changed: migrationChanged,
    worker_changed: workerChanged,
    storefront_changed: storefrontChanged,
    admin_changed: adminChanged,
    r2_config_changed: r2ConfigChanged,
    wrangler_config_changed: wranglerConfigChanged,
    public_runtime_changed: publicRuntimeChanged,
    production_browser_relevant: productionBrowserRelevant,
    deploy_required: deployRequired,
    docs_only: docsOnly,
    d1_remote_required: migrationChanged,
    r2_validation_required: r2ValidationRequired,
    infra_validation_required: infraValidationRequired,
    deep_smoke_relevant: deepSmokeRelevant,
    tests_only: testsOnly,
    development_tooling_only: developmentToolingOnly,
  };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : (process.argv[index + 1] ?? '');
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function resolveFilesFromGit() {
  const head = readArg('--head') || process.env.GITHUB_SHA || 'HEAD';
  let base = readArg('--base') || process.env.CF_CHANGE_BASE_SHA || '';

  if (!base || /^0+$/.test(base)) {
    base = git('rev-parse', `${head}^`);
  }

  const mergeBase = git('merge-base', base, head);
  const output = git('diff', '--name-only', '--diff-filter=ACMR', mergeBase, head);
  return output ? output.split(/\r?\n/) : [];
}

function writeGithubOutputs(classification) {
  if (!process.env.GITHUB_OUTPUT) return;
  const lines = OUTPUT_KEYS.map(
    (key) => `${key}=${classification[key] ? 'true' : 'false'}`,
  );
  appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`, 'utf8');
}

function printSummary(classification) {
  console.log('Cloudflare change classification:');
  for (const key of OUTPUT_KEYS) {
    console.log(`${key}=${classification[key] ? 'true' : 'false'}`);
  }
  console.log(`changed_files=${classification.files.length}`);
  for (const file of classification.files) console.log(`- ${file}`);
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  const filesJson = readArg('--files-json');
  const files = filesJson ? JSON.parse(filesJson) : resolveFilesFromGit();
  const classification = classifyFiles(files);
  printSummary(classification);
  writeGithubOutputs(classification);
}
