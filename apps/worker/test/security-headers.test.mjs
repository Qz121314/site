import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const headers = JSON.parse(
  await readFile(new URL('../../../config/security-headers.json', import.meta.url), 'utf8'),
);

test('storefront CSP permits secure customer-service WebSocket connections', () => {
  const csp = headers['Content-Security-Policy'];
  assert.equal(typeof csp, 'string');
  assert.match(csp, /connect-src[^;]*\bwss:/u);
});
