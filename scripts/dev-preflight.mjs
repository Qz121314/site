import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const rootFiles = [
  '.editorconfig',
  'prettier.config.mjs',
  'eslint.config.mjs',
  'scripts/setup-git-hooks.mjs',
  'scripts/precommit-check.mjs',
  '.githooks/pre-commit',
  '.githooks/pre-push',
];

const requiredScripts = [
  'preflight:dev',
  'fix:changed',
  'precommit:check',
  'guardrails',
  'preflight',
  'verify',
  'format',
  'lint',
  'typecheck',
  'test',
  'build',
  'cf:check',
  'db:migrate:local',
  'db:migrate:remote',
  'deploy:worker',
];

const failures = [];
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function major(version) {
  const match = String(version).match(/(\d+)/);
  return match ? Number(match[1]) : Number.NaN;
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

check(major(process.versions.node) >= 22, `Node.js 22+ is required; found ${process.versions.node}`);
check(packageJson.packageManager === 'pnpm@11.19.0', 'packageManager must remain pinned to pnpm@11.19.0');
check(major(packageJson.engines?.node) >= 22, 'package.json engines.node must require Node.js 22+');
check(major(packageJson.engines?.pnpm) >= 11, 'package.json engines.pnpm must require pnpm 11+');

let pnpmVersion = '';
try {
  pnpmVersion = execFileSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  check(major(pnpmVersion) >= 11, `pnpm 11+ is required; found ${pnpmVersion}`);
} catch (error) {
  failures.push(`pnpm is required and must be executable: ${error.message}`);
}

for (const file of rootFiles) check(existsSync(file), `Required repository contract file is missing: ${file}`);
for (const script of requiredScripts) {
  check(typeof packageJson.scripts?.[script] === 'string' && packageJson.scripts[script].trim(), `Missing package script: ${script}`);
}
check(packageJson.scripts?.prepare === 'node scripts/setup-git-hooks.mjs', 'prepare must install the repository-owned git hooks');
check(packageJson.scripts?.['precommit:check'] === 'node scripts/precommit-check.mjs', 'precommit:check must use the repository-owned staged-file gate');

if (existsSync('.git')) {
  try {
    const hooksPath = execFileSync('git', ['config', '--get', 'core.hooksPath'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    check(hooksPath === '.githooks', `git core.hooksPath must be .githooks; found ${hooksPath || '(unset)'}`);
  } catch {
    failures.push('Unable to verify git core.hooksPath; run pnpm prepare and retry');
  }
} else {
  console.log('Git metadata is unavailable; hook installation state check skipped.');
}

if (failures.length > 0) {
  console.error('Development preflight failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Development preflight passed (Node ${process.versions.node}, pnpm ${pnpmVersion}).`);
  console.log('Recommended flow:');
  console.log('  pnpm preflight:dev');
  console.log('  implement in logical batches');
  console.log('  pnpm fix:changed');
  console.log('  pnpm format && pnpm lint && pnpm typecheck && <targeted tests>');
  console.log('  commit (staged Prettier + ESLint gate)');
  console.log('  pnpm verify before an L-level PR candidate');
  console.log('  PR exact latest-head CI -> release classifier');
}
