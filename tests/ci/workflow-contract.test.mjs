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
  for (const token of tokens) assert.equal(step.includes(token), true, `condition must include ${token}`);
}

test('remote D1 migration actions are migration-gated', () => {
  expectCondition(namedStep(mainWorkflow, 'Record D1 recovery bookmark'), 'migration_changed', 'force_cloudflare_validation');
  expectCondition(namedStep(mainWorkflow, 'Apply D1 migrations'), 'migration_changed', 'force_cloudflare_validation');
});

test('R2 management and probes are R2-config gated', () => {
  for (const name of [
    'Read R2 validation metadata from production D1',
    'Configure and verify public R2 CORS',
    'Probe direct R2 media reads',
  ]) {
    expectCondition(namedStep(mainWorkflow, name), 'r2_validation_required', 'force_cloudflare_validation');
  }
});

test('deploy and production acceptance are change-aware', () => {
  expectCondition(namedStep(mainWorkflow, 'Deploy business platform Worker'), 'deploy_required', 'force_deploy');
  expectCondition(namedStep(mainWorkflow, 'Minimal production smoke'), 'steps.deploy.outputs.deployed');
  expectCondition(namedStep(mainWorkflow, 'Deep production HTTP acceptance'), 'deep_smoke_relevant');
  assert.match(mainWorkflow, /production-browser-relevant/);
  assert.match(mainWorkflow, /needs\.pipeline\.outputs\.deployed == 'true'/);
  assert.doesNotMatch(mainWorkflow, /continue-on-error:\s*true/);
});

test('PR validation is local-only', () => {
  assert.doesNotMatch(prWorkflow, /--remote|CLOUDFLARE_API_TOKEN|wrangler\s+deploy(?!\s+--dry-run)/i);
  assert.match(prWorkflow, /pnpm db:migrate:local/);
  assert.match(prWorkflow, /pnpm cf:check/);
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
});

test('PR build and dry-run reuse one production build', () => {
  const buildCommands = prWorkflow.match(/run:\s*pnpm build\b/g) ?? [];
  assert.equal(buildCommands.length, 1);
  const dryRun = namedStep(prWorkflow, 'Validate Worker bundle from built output');
  assert.match(dryRun, /pnpm cf:check/);
  assert.doesNotMatch(dryRun, /pnpm build/);
});

test('main release verifies/builds once before direct Wrangler deploy', () => {
  assert.match(mainWorkflow, /run:\s*pnpm verify/);
  const deploy = namedStep(mainWorkflow, 'Deploy business platform Worker');
  assert.match(deploy, /pnpm exec wrangler deploy --keep-vars/);
  assert.doesNotMatch(deploy, /pnpm build|db:migrate:remote/);
});

test('classification summary explains remote no-op decisions', () => {
  const summary = namedStep(mainWorkflow, 'Publish Cloudflare classification summary');
  assert.match(summary, /Skip remote D1: no migration diff/);
  assert.match(summary, /Skip R2 validation: no R2\/wrangler config diff/);
  assert.match(summary, /Skip production deploy: no deploy-impacting diff/);
});
