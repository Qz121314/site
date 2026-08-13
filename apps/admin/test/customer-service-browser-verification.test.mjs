import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiSource = readFileSync('src/customer-service/api.ts', 'utf8');

test('customer-service verification is performed by the admin browser', () => {
  assert.match(apiSource, /verification-context/u);
  assert.match(apiSource, /\/integration\/v1\/verify/u);
  assert.match(apiSource, /credentials:\s*['"]omit['"]/u);
  assert.match(apiSource, /Authorization:\s*`Bearer/u);
  assert.match(apiSource, /verification-result/u);
  assert.doesNotMatch(apiSource, /\/test`,\s*['"]POST['"]/u);
});
