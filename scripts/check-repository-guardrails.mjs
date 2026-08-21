import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const [packageText, preCommit, prePush, productionSmoke, ciWorkflow, workflowNames] =
  await Promise.all([
    readFile('package.json', 'utf8'),
    readFile('.githooks/pre-commit', 'utf8'),
    readFile('.githooks/pre-push', 'utf8'),
    readFile('tests/e2e/production-smoke.spec.ts', 'utf8'),
    readFile('.github/workflows/ci.yml', 'utf8'),
    readdir('.github/workflows'),
  ]);

const packageJson = JSON.parse(packageText);
const scripts = packageJson.scripts ?? {};

for (const scriptName of [
  'format',
  'lint',
  'typecheck',
  'db:migrate:local',
  'test',
  'build',
  'cf:check',
  'preflight',
  'verify',
]) {
  assert.equal(
    typeof scripts[scriptName],
    'string',
    `Required package script is missing: ${scriptName}`,
  );
}

for (const requiredStep of [
  'pnpm guardrails',
  'pnpm format',
  'pnpm lint',
  'pnpm typecheck',
]) {
  assert.match(
    scripts.preflight,
    new RegExp(requiredStep.replaceAll(' ', '\\s+'), 'u'),
    `preflight must include: ${requiredStep}`,
  );
}

for (const requiredStep of [
  'pnpm preflight',
  'pnpm db:migrate:local',
  'pnpm test',
  'pnpm build',
  'pnpm cf:check',
]) {
  assert.match(
    scripts.verify,
    new RegExp(requiredStep.replaceAll(' ', '\\s+'), 'u'),
    `verify must include: ${requiredStep}`,
  );
}

assert.match(preCommit, /pnpm\s+preflight/u, 'pre-commit must run pnpm preflight');
assert.match(prePush, /pnpm\s+verify/u, 'pre-push must run pnpm verify');

const brittleProductionPatterns = [
  {
    pattern:
      /fontPack:\s*'[^']+'|mediaStyle:\s*'[^']+'|motionStyle:\s*'[^']+'|navigationStyle:\s*'[^']+'/u,
    reason: 'production smoke must read mutable theme recipe values at runtime',
  },
  {
    pattern: /boxShadow[\s\S]{0,160}\.toBe\(/u,
    reason: 'production smoke must not lock mutable theme shadows to exact values',
  },
  {
    pattern: /\.toBe\('\d+(?:\.\d+)?px'\)/u,
    reason: 'production smoke must not lock mutable visual dimensions to exact pixels',
  },
];

for (const { pattern, reason } of brittleProductionPatterns) {
  assert.doesNotMatch(productionSmoke, pattern, reason);
}

assert.doesNotMatch(
  ciWorkflow,
  /^\s{2}deploy:\s*$/mu,
  'CI must not allocate a second hosted runner job only for production deployment',
);
assert.doesNotMatch(
  ciWorkflow,
  /needs:\s*validate/u,
  'main deployment must continue in the same hosted runner after validation',
);
assert.match(
  ciWorkflow,
  /cancel-in-progress:\s*\$\{\{\s*github\.event_name != 'push' \|\| github\.ref != 'refs\/heads\/main'\s*\}\}/u,
  'main production runs must not cancel an in-progress deployment',
);

const temporaryWorkflow = workflowNames.find((name) =>
  /debug|temporary|diagnostic/iu.test(name),
);
assert.equal(
  temporaryWorkflow,
  undefined,
  `Temporary workflow must not be committed: ${temporaryWorkflow ?? ''}`,
);

console.log('Repository guardrails passed.');
