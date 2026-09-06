import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFiles } from '../../scripts/classify-cloudflare-changes.mjs';

function expectFlags(files, expected) {
  const actual = classifyFiles(files);
  for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value, `${key} for ${files.join(', ')}`);
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
  expectFlags(['AGENTS.md', '.github/workflows/pr-full-verify.yml', 'scripts/dev-preflight.mjs'], {
    docs_only: false,
    development_tooling_only: true,
    deploy_required: false,
    d1_remote_required: false,
    r2_validation_required: false,
  });
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

test('wrangler config changes deploy and run non-R2 infra/deep validation', () => {
  expectFlags(['wrangler.jsonc'], {
    wrangler_config_changed: true,
    deploy_required: true,
    r2_validation_required: false,
    infra_validation_required: true,
    deep_smoke_relevant: true,
  });
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
