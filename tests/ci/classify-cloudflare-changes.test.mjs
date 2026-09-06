import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyFiles,
  classifyPackageJsonChange,
  classifyPnpmLockfileChange,
  classifyWranglerConfigChange,
} from '../../scripts/classify-cloudflare-changes.mjs';

function expectFlags(files, expected) {
  const actual = classifyFiles(files);
  for (const [key, value] of Object.entries(expected))
    assert.equal(actual[key], value, `${key} for ${files.join(', ')}`);
}

test('docs-only is a production Cloudflare no-op', () => {
  expectFlags(['docs/development/workflow.md', 'README.md'], {
    docs_only: true,
    deploy_required: false,
    migration_changed: false,
    r2_config_changed: false,
    d1_remote_required: false,
    r2_validation_required: false,
    production_browser_relevant: false,
  });
});

test('repository contract and workflow tooling do not deploy by themselves', () => {
  expectFlags(
    ['AGENTS.md', '.github/workflows/pr-full-verify.yml', 'scripts/dev-preflight.mjs'],
    {
      docs_only: false,
      development_tooling_only: true,
      deploy_required: false,
      d1_remote_required: false,
      r2_validation_required: false,
    },
  );
});

test('storefront-only changes deploy and run production browser acceptance', () => {
  expectFlags(['apps/storefront/src/App.tsx'], {
    storefront_changed: true,
    admin_changed: false,
    worker_changed: false,
    deploy_required: true,
    migration_changed: false,
    r2_config_changed: false,
    production_browser_relevant: true,
  });
});

test('admin-only changes deploy without storefront production browser acceptance', () => {
  expectFlags(['apps/admin/src/AdminPortal.tsx'], {
    admin_changed: true,
    storefront_changed: false,
    worker_changed: false,
    deploy_required: true,
    production_browser_relevant: false,
  });
});

test('worker-only changes deploy', () => {
  expectFlags(['apps/worker/src/services/auth.ts'], {
    worker_changed: true,
    storefront_changed: false,
    admin_changed: false,
    deploy_required: true,
  });
});

test('public Worker route changes require deep and browser acceptance', () => {
  expectFlags(['apps/worker/src/routes/public/articles.ts'], {
    worker_changed: true,
    public_runtime_changed: true,
    deploy_required: true,
    deep_smoke_relevant: true,
    production_browser_relevant: true,
  });
});

test('migration-only changes retain remote D1 safety and deployment', () => {
  expectFlags(['migrations/0032_example.sql'], {
    migration_changed: true,
    d1_remote_required: true,
    deploy_required: true,
    r2_config_changed: false,
    r2_validation_required: false,
  });
});

test('R2 config-only changes validate R2 without forcing Worker deploy', () => {
  expectFlags(['config/r2-public-cors.json'], {
    r2_config_changed: true,
    r2_validation_required: true,
    infra_validation_required: true,
    deploy_required: false,
    d1_remote_required: false,
  });
});

test('wrangler Worker config changes deploy and run non-R2 infra/deep validation', () => {
  expectFlags(['wrangler.jsonc'], {
    wrangler_config_changed: true,
    deploy_required: true,
    r2_validation_required: false,
    infra_validation_required: true,
    deep_smoke_relevant: true,
  });
});

test('package development scripts and development dependencies are a production no-op', () => {
  const before = JSON.stringify({
    scripts: { lint: 'eslint .', build: 'vite build' },
    devDependencies: { eslint: '^9.0.0' },
  });
  const after = JSON.stringify({
    scripts: { lint: 'eslint . --cache', build: 'vite build' },
    devDependencies: { eslint: '^9.1.0' },
  });
  assert.equal(classifyPackageJsonChange(before, after), false);
  expectFlags(['package.json'], { deploy_required: true });
  assert.equal(
    classifyFiles(['package.json'], {
      packageJson: classifyPackageJsonChange(before, after),
    }).deploy_required,
    false,
  );
});

test('package runtime dependencies and build scripts require a deploy', () => {
  assert.equal(
    classifyPackageJsonChange(
      JSON.stringify({ dependencies: { react: '19.0.0' } }),
      JSON.stringify({ dependencies: { react: '19.1.0' } }),
    ),
    true,
  );
  assert.equal(
    classifyPackageJsonChange(
      JSON.stringify({ scripts: { build: 'vite build' } }),
      JSON.stringify({ scripts: { build: 'vite build --minify esbuild' } }),
    ),
    true,
  );
});

test('lockfile changes limited to dev dependencies are a production no-op', () => {
  const before = `lockfileVersion: '9.0'
\nimporters:
\n  .:
    devDependencies:
      eslint:
        version: 9.0.0
\n  apps/storefront:
    dependencies:
      react:
        version: 19.0.0
`;
  const after = before.replace(
    'eslint:\n        version: 9.0.0',
    'eslint:\n        version: 9.1.0',
  );
  assert.equal(classifyPnpmLockfileChange(before, after), false);
});

test('lockfile runtime dependency changes require a deploy', () => {
  const before = `lockfileVersion: '9.0'
\nimporters:
\n  apps/storefront:
    dependencies:
      react:
        version: 19.0.0
`;
  const after = before.replace('version: 19.0.0', 'version: 19.1.0');
  assert.equal(classifyPnpmLockfileChange(before, after), true);
});

test('wrangler config changes identify D1, R2, assets, and Worker impact separately', () => {
  const base = `{
  // JSONC comment
  "name": "site",
  "main": "apps/worker/src/index.ts",
  "assets": { "directory": "./dist" },
  "d1_databases": [{ "binding": "DB", "database_id": "one" }],
  "r2_buckets": [{ "binding": "ASSETS", "bucket_name": "one" }],
}`;
  const d1 = classifyWranglerConfigChange(
    base,
    base.replace('"one" }],\n  "r2', '"two" }],\n  "r2'),
  );
  assert.deepEqual(d1, {
    changed: true,
    worker: false,
    d1: true,
    r2: false,
    assets: false,
  });
  const r2 = classifyWranglerConfigChange(
    base,
    base.replace('bucket_name": "one', 'bucket_name": "two'),
  );
  assert.deepEqual(r2, {
    changed: true,
    worker: false,
    d1: false,
    r2: true,
    assets: false,
  });
  const assets = classifyWranglerConfigChange(base, base.replace('./dist', './public'));
  assert.deepEqual(assets, {
    changed: true,
    worker: false,
    d1: false,
    r2: false,
    assets: true,
  });
  const worker = classifyWranglerConfigChange(
    base,
    base.replace('"site"', '"site-next"'),
  );
  assert.deepEqual(worker, {
    changed: true,
    worker: true,
    d1: false,
    r2: false,
    assets: false,
  });
});

test('resource-aware Wrangler R2 config requires R2 validation without a D1 migration', () => {
  const classification = classifyFiles(['wrangler.jsonc'], {
    wrangler: { changed: true, worker: false, d1: false, r2: true, assets: false },
  });
  assert.equal(classification.wrangler_r2_config_changed, true);
  assert.equal(classification.r2_validation_required, true);
  assert.equal(classification.d1_remote_required, false);
  assert.equal(classification.deploy_required, true);
});

test('shared package changes conservatively affect all built applications', () => {
  expectFlags(['packages/shared/src/markdown.ts'], {
    worker_changed: true,
    storefront_changed: true,
    admin_changed: true,
    deploy_required: true,
    production_browser_relevant: true,
  });
});

test('tests-only changes do not access production Cloudflare resources', () => {
  expectFlags(['tests/unit/example.test.ts'], {
    tests_only: true,
    deploy_required: false,
    d1_remote_required: false,
    r2_validation_required: false,
  });
});

test('nested application test helpers do not masquerade as runtime changes', () => {
  expectFlags(
    ['apps/storefront/test/register-ts-resolver.mjs', 'apps/worker/test/sqlite-d1.mjs'],
    {
      tests_only: true,
      storefront_changed: false,
      worker_changed: false,
      deploy_required: false,
      production_browser_relevant: false,
    },
  );
});

test('normalizes and de-duplicates Windows paths before classification', () => {
  const classification = classifyFiles([
    '.\\apps\\storefront\\test\\register-ts-resolver.mjs',
    'apps/storefront/test/register-ts-resolver.mjs',
  ]);
  assert.deepEqual(classification.files, [
    'apps/storefront/test/register-ts-resolver.mjs',
  ]);
  assert.equal(classification.tests_only, true);
  assert.equal(classification.deploy_required, false);
});
