import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mainWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const prWorkflow = readFileSync('.github/workflows/pr-full-verify.yml', 'utf8');
const e2eWorkflow = readFileSync('.github/workflows/storefront-critical-e2e.yml', 'utf8');

function namedStep(workflow, name) {
  const lines = workflow.split(/\r?\n/);
  const marker = `- name: ${name}`;
  const start = lines.findIndex((line) => line.trim() === marker);
  assert.notEqual(start, -1, `missing workflow step: ${name}`);
  const indent = lines[start].match(/^\s*/)[0].length;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    const currentIndent = lines[index].match(/^\s*/)[0].length;
    if (trimmed.startsWith('- name: ') && currentIndent === indent) {
      end = index;
      break;
    }
    if (trimmed && currentIndent < indent) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function expectCondition(step, ...tokens) {
  assert.match(step, /^\s*if:/m, 'step must have an explicit condition');
  for (const token of tokens)
    assert.equal(step.includes(token), true, `condition must include ${token}`);
}

function workflowJob(workflow, id) {
  const match = new RegExp(
    `^  ${id}:\\n([\\s\\S]*?)(?=^  [A-Za-z0-9_-]+:|(?![\\s\\S]))`,
    'm',
  ).exec(workflow);
  assert.notEqual(match, null, `missing workflow job: ${id}`);
  return match[1];
}

test('remote D1 migration actions require a migration diff or dedicated override', () => {
  for (const name of ['Record D1 recovery bookmark', 'Apply D1 migrations']) {
    const step = namedStep(mainWorkflow, name);
    expectCondition(step, 'migration_changed', 'force_d1_migrations');
    assert.doesNotMatch(step, /force_cloudflare_validation/);
  }
  assert.match(mainWorkflow, /force_d1_migrations:/);
});

test('R2 management and probes are R2-config gated', () => {
  for (const name of [
    'Read R2 validation metadata from production D1',
    'Verify selected R2 custom domain',
    'Configure and verify public R2 CORS',
    'Probe direct R2 media reads',
  ]) {
    expectCondition(
      namedStep(mainWorkflow, name),
      'r2_validation_required',
      'force_cloudflare_validation',
    );
  }
});

test('published bootstrap compatibility is checked before public runtime deployment', () => {
  const gate = namedStep(mainWorkflow, 'Verify published bootstrap compatibility');
  expectCondition(gate, 'public_runtime_changed', 'deploy_required', 'force_deploy');
  assert.match(gate, /check-storefront-bootstrap-compatibility\.mjs/);
  assert.match(gate, /R2_BUCKET_NAME:\s*service-catalog-site-assets/);
  assert.doesNotMatch(gate, /wrangler\s+d1|r2\s+object\s+(?:put|delete)|cors\s+set/i);
  assert.ok(
    mainWorkflow.indexOf('- name: Verify published bootstrap compatibility') <
      mainWorkflow.indexOf('- name: Deploy business platform Worker'),
    'bootstrap compatibility must be checked before Worker deploy',
  );
});

test('deploy and production acceptance are change-aware', () => {
  expectCondition(
    namedStep(mainWorkflow, 'Deploy business platform Worker'),
    'deploy_required',
    'force_deploy',
  );
  expectCondition(
    namedStep(mainWorkflow, 'Minimal production smoke'),
    'steps.deploy.outputs.deployed',
  );
  expectCondition(
    namedStep(mainWorkflow, 'Deep production HTTP acceptance'),
    'deep_smoke_relevant',
  );
  assert.match(mainWorkflow, /production_browser_relevant/);
  assert.match(mainWorkflow, /needs\.pipeline\.outputs\.deployed == 'true'/);
  assert.doesNotMatch(mainWorkflow, /continue-on-error:\s*true/);
});

test('PR validation is local-only and keeps the Admin browser fixture local', () => {
  assert.doesNotMatch(
    prWorkflow,
    /--remote|CLOUDFLARE_API_TOKEN|wrangler\s+deploy(?!\s+--dry-run)/i,
  );
  assert.match(prWorkflow, /name:\s*Verify Admin desktop shell/);
  assert.match(prWorkflow, /E2E_ADMIN_LOCAL_SERVER: '1'/);
});

test('pnpm store caching is lockfile-keyed and node_modules is not cached', () => {
  for (const workflow of [mainWorkflow, prWorkflow, e2eWorkflow]) {
    assert.match(workflow, /cache:\s*pnpm/);
    assert.match(workflow, /cache-dependency-path:\s*pnpm-lock\.yaml/);
    assert.doesNotMatch(workflow, /path:\s*.*node_modules/);
  }
});

test('Playwright Chromium cache is preserved', () => {
  assert.match(mainWorkflow, /path:\s*~\/\.cache\/ms-playwright/);
  assert.match(e2eWorkflow, /path:\s*~\/\.cache\/ms-playwright/);
  assert.match(prWorkflow, /path:\s*~\/\.cache\/ms-playwright/);
});

test('PR Full Verify preserves independent validation layers as parallel jobs', () => {
  const quality = workflowJob(prWorkflow, 'quality');
  const repositoryTests = workflowJob(prWorkflow, 'tests');
  const build = workflowJob(prWorkflow, 'build-dry-run');
  const adminPlaywright = workflowJob(prWorkflow, 'admin-playwright');

  assert.match(quality, /name:\s*Quality \+ Local D1/);
  assert.match(quality, /run:\s*pnpm preflight/);
  assert.match(quality, /run:\s*pnpm db:migrate:local/);
  assert.match(repositoryTests, /name:\s*Tests/);
  assert.match(repositoryTests, /run:\s*pnpm test/);
  assert.match(build, /name:\s*Build \+ Worker/);
  assert.match(build, /run:\s*pnpm build/);
  assert.match(build, /check-storefront-bundle-budget\.mjs/);
  assert.match(build, /run:\s*pnpm cf:check/);
  assert.match(adminPlaywright, /name:\s*Admin Playwright/);
  assert.match(adminPlaywright, /run:\s*pnpm test:admin-shell:e2e/);

  for (const job of [quality, repositoryTests, build, adminPlaywright])
    assert.doesNotMatch(job, /^\s+needs:/m);

  assert.doesNotMatch(prWorkflow, /run:\s*pnpm verify\b/);
});

test('main release verifies/builds once before direct Wrangler deploy', () => {
  assert.match(mainWorkflow, /run:\s*pnpm verify/);
  const deploy = namedStep(mainWorkflow, 'Deploy business platform Worker');
  assert.match(deploy, /pnpm exec wrangler deploy --keep-vars/);
  assert.doesNotMatch(deploy, /pnpm build|db:migrate:remote/);
});

test('classification summary explains remote no-op decisions', () => {
  const summary = namedStep(mainWorkflow, 'Publish Cloudflare classification summary');
  assert.match(
    summary,
    /Skip remote D1: no migration diff or explicit migration override/,
  );
  assert.match(summary, /Skip R2 validation: no R2 config diff/);
  assert.match(summary, /Skip production deploy: no deploy-impacting diff/);
});
