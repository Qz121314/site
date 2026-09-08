import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import prettier from 'prettier';

const target = 'apps/storefront/test/public-content-origin-discovery.test.mjs';

test('print exact Prettier output for Q4A origin discovery test', async () => {
  const source = await readFile(target, 'utf8');
  const config = await prettier.resolveConfig(target);
  const formatted = await prettier.format(source, { ...config, filepath: target });
  assert.fail(`PRETTIER_OUTPUT_START\n${formatted}PRETTIER_OUTPUT_END`);
});
