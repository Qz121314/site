import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const agents = readFileSync('AGENTS.md', 'utf8');
const hook = readFileSync('.githooks/pre-commit', 'utf8');
const precommit = readFileSync('scripts/precommit-check.mjs', 'utf8');
const devPreflight = readFileSync('scripts/dev-preflight.mjs', 'utf8');
const wranglerTypes = readFileSync('scripts/ensure-wrangler-types.mjs', 'utf8');
const prepushVerify = readFileSync('scripts/prepush-verify.mjs', 'utf8');

const requiredDocs = [
  'docs/development/workflow.md',
  'docs/development/formatting.md',
  'docs/development/testing.md',
  'docs/development/cloudflare-ci.md',
  'docs/development/database.md',
  'docs/development/deployment.md',
];

test('package exposes the executable development contract', () => {
  for (const script of [
    'preflight:dev',
    'fix:changed',
    'precommit:check',
    'verify',
    'deploy:worker',
  ]) {
    assert.equal(typeof packageJson.scripts[script], 'string', `missing ${script}`);
  }
  assert.match(packageJson.scripts.prepare, /setup-git-hooks\.mjs/);
  assert.doesNotMatch(packageJson.scripts['deploy:worker'], /migrate|d1|--remote/i);
  assert.doesNotMatch(packageJson.scripts.deploy, /migrate|d1|--remote/i);
});

test('AGENTS points to preflight, exact-head CI, and classifier-owned release', () => {
  assert.match(agents, /pnpm preflight:dev/);
  assert.match(agents, /exact latest PR HEAD SHA/i);
  assert.match(agents, /classify-cloudflare-changes\.mjs/);
  for (const doc of requiredDocs)
    assert.match(agents, new RegExp(doc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('development docs have one owned structure', () => {
  for (const doc of requiredDocs)
    assert.equal(existsSync(doc), true, `${doc} must exist`);
  const compatibility = readFileSync('docs/development-standards.md', 'utf8');
  assert.match(compatibility, /compatibility pointer/i);
});

test('pre-commit is staged-file oriented and not a full verify gate', () => {
  assert.match(hook, /pnpm(?:\.cmd)? precommit:check/);
  assert.doesNotMatch(hook, /pnpm (?:preflight|verify|test|build|typecheck)/);
  assert.match(precommit, /["']diff["'],\s*["']--cached["']/);
  assert.match(precommit, /git\(\[["']show["']/);
  assert.match(precommit, /prettier\.resolveConfig/);
  assert.doesNotMatch(precommit, /wrangler|--remote|https?:\/\//i);
});

test('development preflight cannot touch production Cloudflare', () => {
  assert.match(devPreflight, /packageManager/);
  assert.match(devPreflight, /core\.hooksPath/);
  assert.match(devPreflight, /process\.env\.ComSpec/);
  assert.doesNotMatch(
    devPreflight,
    /--remote|wrangler d1|wrangler r2|wrangler deploy|CLOUDFLARE_API_TOKEN/,
  );
});

test('local tooling can invoke pnpm through Windows command shells', () => {
  assert.match(wranglerTypes, /process\.env\.ComSpec/);
  assert.match(prepushVerify, /process\.env\.ComSpec/);
  assert.doesNotMatch(wranglerTypes, /--remote|wrangler deploy|CLOUDFLARE_API_TOKEN/);
});
