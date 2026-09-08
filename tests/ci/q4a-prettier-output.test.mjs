import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as prettier from 'prettier';

const targets = [
  'scripts/validate-public-content-origin.mjs',
  'tests/ci/public-content-origin-release.test.mjs',
];

for (const target of targets) {
  test(`Q4A Prettier output: ${target}`, async () => {
    const source = await readFile(target, 'utf8');
    const formatted = await prettier.format(source, { filepath: target });
    console.log(`Q4A_FORMAT_START:${target}\n${formatted}Q4A_FORMAT_END:${target}`);
  });
}
