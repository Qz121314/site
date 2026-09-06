import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import prettier from 'prettier';
import { ESLint } from 'eslint';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

if (!existsSync('.git')) {
  console.log('No .git directory; changed-file fixer skipped.');
  process.exit(0);
}

const stagedOnly = process.argv.includes('--staged');
const commands = stagedOnly
  ? [['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']]
  : [
      ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD', '-z'],
      ['ls-files', '--others', '--exclude-standard', '-z'],
    ];

const files = new Set();
for (const command of commands) {
  const output = git(command);
  for (const file of output.split('\0').filter(Boolean)) {
    if (existsSync(file)) files.add(file);
  }
}

if (files.size === 0) {
  console.log('No changed files to fix.');
  process.exit(0);
}

const formattedFiles = [];
for (const file of files) {
  const info = await prettier.getFileInfo(file);
  if (info.ignored || !info.inferredParser) continue;
  const source = readFileSync(file, 'utf8');
  const formatted = await prettier.format(source, { filepath: file });
  if (formatted !== source) {
    writeFileSync(file, formatted, 'utf8');
    formattedFiles.push(file);
  }
}

const lintable = [...files].filter((file) => /\.(?:c|m)?(?:js|jsx|ts|tsx)$/i.test(file));
let lintFixed = 0;
if (lintable.length > 0) {
  const eslint = new ESLint({ fix: true });
  const results = await eslint.lintFiles(lintable);
  await ESLint.outputFixes(results);
  lintFixed = results.filter((result) => result.output).length;
}

console.log(`Changed-file fix complete: ${files.size} file(s), ${formattedFiles.length} formatted, ${lintFixed} ESLint-fixed.`);
