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
  'wrangler_worker_config_changed',
  'wrangler_d1_config_changed',
  'wrangler_r2_config_changed',
  'wrangler_assets_config_changed',
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
  'verification_profile',
];

const normalizePath = (value) => value.replaceAll('\\', '/').replace(/^\.\//, '');
const matchesAny = (value, patterns) => patterns.some((pattern) => pattern.test(value));

function stripJsonc(value) {
  let output = '';
  let quote = '';
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];
    if (quote) {
      output += character;
      if (character === '\\') output += value[(index += 1)] ?? '';
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      output += character;
      continue;
    }
    if (character === '/' && next === '/') {
      index = value.indexOf('\n', index);
      if (index === -1) break;
      output += '\n';
      continue;
    }
    if (character === '/' && next === '*') {
      const end = value.indexOf('*/', index + 2);
      index = end === -1 ? value.length : end + 1;
      continue;
    }
    output += character;
  }
  return output.replace(/,\s*([}\]])/g, '$1');
}

function parseJsonc(value) {
  if (!value) return {};
  return JSON.parse(stripJsonc(value));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

const changed = (before, after) => stableJson(before) !== stableJson(after);

export function classifyWranglerConfigChange(beforeContents, afterContents) {
  const before = parseJsonc(beforeContents);
  const after = parseJsonc(afterContents);
  const d1 = changed(before.d1_databases, after.d1_databases);
  const r2 = changed(before.r2_buckets, after.r2_buckets);
  const assets = changed(before.assets, after.assets);
  const workerKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  workerKeys.delete('d1_databases');
  workerKeys.delete('r2_buckets');
  workerKeys.delete('assets');
  const worker = [...workerKeys].some((key) => changed(before[key], after[key]));
  return {
    changed: d1 || r2 || assets || worker,
    worker,
    d1,
    r2,
    assets,
  };
}

function changedObjectKeys(beforeContents, afterContents) {
  const before = JSON.parse(beforeContents || '{}');
  const after = JSON.parse(afterContents || '{}');
  return new Set(
    [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) =>
      changed(before[key], after[key]),
    ),
  );
}

const PRODUCTION_PACKAGE_KEYS = new Set([
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
]);

const PRODUCTION_SCRIPT_NAMES = /^(?:build(?::|$)|deploy(?::|$)|start$|serve$)/;

export function classifyPackageJsonChange(beforeContents, afterContents) {
  const changedKeys = changedObjectKeys(beforeContents, afterContents);
  if ([...changedKeys].some((key) => PRODUCTION_PACKAGE_KEYS.has(key))) return true;
  if (!changedKeys.has('scripts')) return false;
  const beforeScripts = JSON.parse(beforeContents || '{}').scripts ?? {};
  const afterScripts = JSON.parse(afterContents || '{}').scripts ?? {};
  return [...new Set([...Object.keys(beforeScripts), ...Object.keys(afterScripts)])].some(
    (name) =>
      PRODUCTION_SCRIPT_NAMES.test(name) && beforeScripts[name] !== afterScripts[name],
  );
}

function runtimeImporterVersions(contents) {
  const versions = new Map();
  let importer = '';
  let section = '';
  let dependency = '';
  for (const line of (contents || '').split(/\r?\n/)) {
    const importerMatch = line.match(/^ {2}(\S.*):\s*$/);
    if (importerMatch) {
      importer = importerMatch[1];
      section = '';
      dependency = '';
      continue;
    }
    const sectionMatch = line.match(
      /^ {4}(dependencies|optionalDependencies|devDependencies):\s*$/,
    );
    if (sectionMatch) {
      section = sectionMatch[1];
      dependency = '';
      continue;
    }
    const dependencyMatch = line.match(/^ {6}('[^']+'|[^:\s]+):\s*$/);
    if (dependencyMatch) {
      dependency = dependencyMatch[1];
      continue;
    }
    const versionMatch = line.match(/^ {8}version:\s*(.+)$/);
    if (
      versionMatch &&
      importer &&
      dependency &&
      (section === 'dependencies' || section === 'optionalDependencies')
    ) {
      versions.set(`${importer}:${section}:${dependency}`, versionMatch[1]);
    }
  }
  return versions;
}

export function classifyPnpmLockfileChange(beforeContents, afterContents) {
  const before = runtimeImporterVersions(beforeContents);
  const after = runtimeImporterVersions(afterContents);
  const keys = new Set([...before.keys(), ...after.keys()]);
  return [...keys].some((key) => before.get(key) !== after.get(key));
}

function conservativeWranglerImpact() {
  return { changed: true, worker: true, d1: false, r2: false, assets: false };
}

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

export function classifyFiles(inputFiles, impacts = {}) {
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

  const wranglerImpact = files.includes('wrangler.jsonc')
    ? (impacts.wrangler ?? conservativeWranglerImpact())
    : { changed: false, worker: false, d1: false, r2: false, assets: false };
  const wranglerConfigChanged = wranglerImpact.changed;
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

  const buildOrReleaseInputChanged =
    (files.includes('package.json') && (impacts.packageJson ?? true)) ||
    (files.includes('pnpm-lock.yaml') && (impacts.pnpmLockfile ?? true)) ||
    files.some((path) =>
      [
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

  const r2ValidationRequired = r2ConfigChanged || wranglerImpact.r2;
  const infraValidationRequired = r2ValidationRequired || wranglerConfigChanged;
  const productionBrowserRelevant =
    storefrontChanged ||
    publicRuntimeChanged ||
    wranglerImpact.assets ||
    productionBrowserContractChanged;
  const deepSmokeRelevant =
    storefrontChanged ||
    publicRuntimeChanged ||
    r2ValidationRequired ||
    wranglerImpact.worker ||
    wranglerImpact.assets;

  const docsOnly = files.length > 0 && files.every(isDocumentation);
  const testsOnly = files.length > 0 && files.every(isTestPath);
  const developmentToolingOnly =
    files.length > 0 &&
    files.every(
      (path) => isDocumentation(path) || isDevelopmentTooling(path) || isTestPath(path),
    );
  const verificationProfile = deployRequired
    ? 'full'
    : r2ValidationRequired || infraValidationRequired
      ? 'cloudflare'
      : testsOnly
        ? 'tests'
        : docsOnly
          ? 'docs'
          : developmentToolingOnly
            ? 'quality'
            : 'full';

  return {
    files,
    migration_changed: migrationChanged,
    worker_changed: workerChanged,
    storefront_changed: storefrontChanged,
    admin_changed: adminChanged,
    r2_config_changed: r2ConfigChanged,
    wrangler_config_changed: wranglerConfigChanged,
    wrangler_worker_config_changed: wranglerImpact.worker,
    wrangler_d1_config_changed: wranglerImpact.d1,
    wrangler_r2_config_changed: wranglerImpact.r2,
    wrangler_assets_config_changed: wranglerImpact.assets,
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
    verification_profile: verificationProfile,
  };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : (process.argv[index + 1] ?? '');
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function showFileAt(ref, path) {
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' });
  } catch {
    return '';
  }
}

function resolveFilesFromGit() {
  const head = readArg('--head') || process.env.GITHUB_SHA || 'HEAD';
  let base = readArg('--base') || process.env.CF_CHANGE_BASE_SHA || '';

  if (!base || /^0+$/.test(base)) {
    base = git('rev-parse', `${head}^`);
  }

  const mergeBase = git('merge-base', base, head);
  const output = git('diff', '--name-only', '--diff-filter=ACMR', mergeBase, head);
  const files = output ? output.split(/\r?\n/) : [];
  return {
    files,
    impacts: {
      packageJson: files.includes('package.json')
        ? classifyPackageJsonChange(
            showFileAt(mergeBase, 'package.json'),
            showFileAt(head, 'package.json'),
          )
        : false,
      pnpmLockfile: files.includes('pnpm-lock.yaml')
        ? classifyPnpmLockfileChange(
            showFileAt(mergeBase, 'pnpm-lock.yaml'),
            showFileAt(head, 'pnpm-lock.yaml'),
          )
        : false,
      wrangler: files.includes('wrangler.jsonc')
        ? classifyWranglerConfigChange(
            showFileAt(mergeBase, 'wrangler.jsonc'),
            showFileAt(head, 'wrangler.jsonc'),
          )
        : undefined,
    },
  };
}

function writeGithubOutputs(classification) {
  if (!process.env.GITHUB_OUTPUT) return;
  const lines = OUTPUT_KEYS.map(
    (key) =>
      `${key}=${key === 'verification_profile' ? classification[key] : classification[key] ? 'true' : 'false'}`,
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
  const resolved = filesJson
    ? { files: JSON.parse(filesJson), impacts: {} }
    : resolveFilesFromGit();
  const classification = classifyFiles(resolved.files, resolved.impacts);
  printSummary(classification);
  writeGithubOutputs(classification);
}
