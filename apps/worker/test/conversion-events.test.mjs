import assert from 'node:assert/strict';
import test from 'node:test';
import { createConversionEventStatement } from '../src/conversion/conversion-events.ts';

test('conversion event statement records the actual group, target, outcome and request id', () => {
  let captured;
  const db = {
    prepare(sql) {
      captured = {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
      };
      return captured;
    },
  };

  createConversionEventStatement(db, {
    sectionId: 'section-1',
    productId: 'product-1',
    conversionGroupId: 'group-1',
    conversionTargetId: 'target-b',
    mode: 'link',
    outcome: 'redirected',
    requestId: 'request-1',
    metadata: { targetName: 'B' },
    createdAt: '2026-08-07T03:00:00.000Z',
  });

  assert.ok(captured.sql.includes("'click'"));
  assert.equal(captured.args[1], 'section-1');
  assert.equal(captured.args[2], 'product-1');
  assert.equal(captured.args[3], 'group-1');
  assert.equal(captured.args[4], 'target-b');
  assert.equal(captured.args[5], 'link');
  assert.equal(captured.args[6], 'redirected');
  assert.equal(captured.args[7], 'request-1');
  assert.equal(captured.args[8], JSON.stringify({ targetName: 'B' }));
  assert.equal(captured.args[9], '2026-08-07T03:00:00.000Z');
  assert.match(captured.args[0], /^[0-9a-f-]{36}$/i);
});

test('conversion event statement allows not-ready events without a selected target', () => {
  let args;
  const db = {
    prepare() {
      return {
        bind(...values) {
          args = values;
          return this;
        },
      };
    },
  };

  createConversionEventStatement(db, {
    sectionId: 'section-1',
    productId: 'product-1',
    conversionGroupId: null,
    conversionTargetId: null,
    mode: null,
    outcome: 'not_ready',
    requestId: 'request-2',
    metadata: null,
    createdAt: '2026-08-07T03:01:00.000Z',
  });

  assert.equal(args[3], null);
  assert.equal(args[4], null);
  assert.equal(args[5], null);
  assert.equal(args[6], 'not_ready');
  assert.equal(args[8], null);
});
