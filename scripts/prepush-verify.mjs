import { spawnSync } from 'node:child_process';

const prettierExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mdx',
  '.mjs',
  '.scss',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);
const eslintExtensions = new Set(['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx']);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    shell: false,
  });

  if (options.capture) {
    if (result.status !== 0) return null;
    return result.stdout.trim();
  }

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return '';
}

function gitOutput(...args) {
  return run('git', args, { capture: true });
}

function refExists(ref) {
  return gitOutput('rev-parse', '--verify', '--quiet', ref) !== null;
}

function resolveBaseRef() {
  if (process.env.PREPUSH_BASE && refExists(process.env.PREPUSH_BASE)) {
    return process.env.PREPUSH_BASE;
  }

  const upstream = gitOutput(
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{upstream}',
  );
  if (upstream && refExists(upstream)) return upstream;
  if (refExists('origin/main')) return 'origin/main';
  if (refExists('HEAD~1')) return 'HEAD~1';
  return 'HEAD';
}

function extensionOf(file) {
  const slash = file.lastIndexOf('/');
  const dot = file.lastIndexOf('.');
  return dot > slash ? file.slice(dot) : '';
}

const baseRef = resolveBaseRef();
const diff = gitOutput('diff', '--name-only', '--diff-filter=ACMR', `${baseRef}...HEAD`);
const changedFiles = diff ? diff.split('\n').filter(Boolean) : [];

console.log(`Fast pre-push verification against ${baseRef}.`);
console.log(`Changed files: ${changedFiles.length}`);

const prettierFiles = changedFiles.filter((file) =>
  prettierExtensions.has(extensionOf(file)),
);
if (prettierFiles.length > 0) {
  run('pnpm', ['exec', 'prettier', '--check', ...prettierFiles]);
}

const eslintFiles = changedFiles.filter((file) =>
  eslintExtensions.has(extensionOf(file)),
);
if (eslintFiles.length > 0) {
  run('pnpm', ['exec', 'eslint', ...eslintFiles]);
}

run('pnpm', ['guardrails']);
run('pnpm', ['typecheck']);

const storefrontChanged = changedFiles.some(
  (file) =>
    file.startsWith('apps/storefront/') ||
    file.startsWith('packages/storefront-ui/') ||
    file.startsWith('scripts/check-storefront-'),
);
if (storefrontChanged) {
  run('pnpm', ['--filter', '@site/storefront', 'test']);
}

console.log(
  'Fast pre-push verification passed. Full tests, build budget, and Worker dry-run run in CI.',
);
