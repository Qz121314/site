import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const outputPath = 'apps/worker/src/worker-configuration.d.ts';
const stampPath = '.wrangler/generated-types-input.sha256';
const inputPaths = ['wrangler.jsonc', 'package.json', 'pnpm-lock.yaml'];

const hash = createHash('sha256');
for (const path of inputPaths) {
  hash.update(path);
  hash.update('\0');
  hash.update(readFileSync(path));
  hash.update('\0');
}
const expected = hash.digest('hex');

if (existsSync(outputPath) && existsSync(stampPath) && readFileSync(stampPath, 'utf8').trim() === expected) {
  console.log('Wrangler types are current; reusing generated output.');
  process.exit(0);
}

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(command, ['exec', 'wrangler', 'types', outputPath], {
  stdio: 'inherit',
  shell: false,
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

mkdirSync(dirname(stampPath), { recursive: true });
writeFileSync(stampPath, `${expected}\n`, 'utf8');
console.log('Wrangler types generated and cache stamp updated.');
