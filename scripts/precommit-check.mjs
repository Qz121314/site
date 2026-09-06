import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import prettier from 'prettier';
import { ESLint } from 'eslint';

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

if (!existsSync('.git')) {
  console.log('No .git directory; staged-file commit gate skipped.');
  process.exit(0);
}

let files = [];
try {
  const output = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']);
  files = output.split('\0').filter(Boolean);
} catch (error) {
  console.error(`Unable to read staged files: ${error.message}`);
  process.exit(1);
}

if (files.length === 0) {
  console.log('No staged files; commit gate passed.');
  process.exit(0);
}

const formatFailures = [];
for (const file of files) {
  const info = await prettier.getFileInfo(file);
  if (info.ignored || !info.inferredParser) continue;

  let source;
  try {
    source = git(['show', `:${file}`]);
  } catch {
    continue;
  }
  const options = (await prettier.resolveConfig(file)) ?? {};
  const formatted = await prettier.format(source, { ...options, filepath: file });
  if (formatted !== source) formatFailures.push(file);
}

const lintable = files.filter((file) => /\.(?:c|m)?(?:js|jsx|ts|tsx)$/i.test(file));
const lintFailures = [];
if (lintable.length > 0) {
  const eslint = new ESLint({ fix: false });
  for (const file of lintable) {
    let source;
    try {
      source = git(['show', `:${file}`]);
    } catch {
      continue;
    }
    const [result] = await eslint.lintText(source, {
      filePath: file,
      warnIgnored: false,
    });
    if (result && result.errorCount > 0) {
      lintFailures.push({
        file,
        messages: result.messages.filter((message) => message.severity === 2),
      });
    }
  }
}

if (formatFailures.length > 0 || lintFailures.length > 0) {
  if (formatFailures.length > 0) {
    console.error('Prettier failed for staged files:');
    for (const file of formatFailures) console.error(`- ${file}`);
    console.error('Run pnpm fix:changed, review the result, then stage the files again.');
  }
  if (lintFailures.length > 0) {
    console.error('ESLint failed for staged files:');
    for (const failure of lintFailures) {
      console.error(`- ${failure.file}`);
      for (const message of failure.messages) {
        console.error(
          `  ${message.line ?? 0}:${message.column ?? 0} ${message.message} (${message.ruleId ?? 'eslint'})`,
        );
      }
    }
  }
  process.exit(1);
}

console.log(`Commit gate passed for ${files.length} staged file(s).`);
