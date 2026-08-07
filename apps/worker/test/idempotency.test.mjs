import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createIdempotencyStatement,
  normalizeIdempotencyKey,
  pruneExpiredIdempotencyKeys,
  readIdempotentResponse,
} from '../src/idempotency/idempotency.ts';

function statement(sql, handlers = {}) {
  return {
    sql,
    args: [],
    bind(...args) {
      this.args = args;
      return this;
    },
    async run() {
      return handlers.run ? handlers.run(this) : { meta: { changes: 0 } };
    },
    async first() {
      return handlers.first ? handlers.first(this) : null;
    },
  };
}

test('idempotency key normalization rejects missing and oversized keys', () => {
  assert.equal(normalizeIdempotencyKey(undefined), null);
  assert.equal(normalizeIdempotencyKey(''), null);
  assert.equal(normalizeIdempotencyKey('x'.repeat(129)), null);
  assert.equal(normalizeIdempotencyKey('x'.repeat(128)), 'x'.repeat(128));
});

test('stored idempotency responses expire exactly 24 hours later and are scoped', () => {
  let captured;
  const db = {
    prepare(sql) {
      captured = statement(sql);
      return captured;
    },
  };
  const now = '2026-08-07T03:00:00.000Z';

  const prepared = createIdempotencyStatement(
    db,
    'faq.batch-delete',
    'request-1',
    { deletedIds: ['faq-1'] },
    now,
    200,
  );

  assert.equal(prepared, captured);
  assert.ok(captured.sql.includes('INSERT INTO idempotency_keys'));
  assert.deepEqual(captured.args, [
    'faq.batch-delete:request-1',
    'faq.batch-delete',
    200,
    JSON.stringify({ deletedIds: ['faq-1'] }),
    '2026-08-08T03:00:00.000Z',
    now,
  ]);
});

test('expired idempotency cleanup is bounded to 250 rows per pass', async () => {
  let captured;
  const db = {
    prepare(sql) {
      captured = statement(sql, { run: () => ({ meta: { changes: 137 } }) });
      return captured;
    },
  };

  const removed = await pruneExpiredIdempotencyKeys(db, '2026-08-07T03:00:00.000Z');

  assert.equal(removed, 137);
  assert.ok(captured.sql.includes('LIMIT ?'));
  assert.deepEqual(captured.args, ['2026-08-07T03:00:00.000Z', 250]);
});

test('read prunes expired rows before returning a valid scoped response', async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      if (sql.includes('DELETE FROM idempotency_keys')) {
        return statement(sql, {
          run(current) {
            calls.push({ kind: 'prune', args: current.args });
            return { meta: { changes: 2 } };
          },
        });
      }
      if (sql.includes('SELECT response_body')) {
        return statement(sql, {
          first(current) {
            calls.push({ kind: 'read', args: current.args });
            return { response_body: JSON.stringify({ ok: true }) };
          },
        });
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const now = '2026-08-07T03:00:00.000Z';

  const result = await readIdempotentResponse(db, 'products.batch-delete', 'abc', now);

  assert.deepEqual(result, { ok: true });
  assert.equal(calls[0].kind, 'prune');
  assert.equal(calls[1].kind, 'read');
  assert.deepEqual(calls[1].args, [
    'products.batch-delete:abc',
    'products.batch-delete',
    now,
  ]);
});

test('invalid stored JSON is treated as a cache miss instead of breaking the operation', async () => {
  const db = {
    prepare(sql) {
      if (sql.includes('DELETE FROM idempotency_keys')) {
        return statement(sql, { run: () => ({ meta: { changes: 0 } }) });
      }
      return statement(sql, { first: () => ({ response_body: '{broken' }) });
    },
  };

  const result = await readIdempotentResponse(
    db,
    'products.batch-delete',
    'abc',
    '2026-08-07T03:00:00.000Z',
  );
  assert.equal(result, null);
});
