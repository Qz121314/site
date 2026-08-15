import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getConversionTrafficReport,
  normalizeTrafficMonth,
  recordConversionTrafficEvent,
  trafficBusinessDate,
  trafficMonthDays,
} from '../src/conversion-traffic/conversion-traffic.ts';

test('traffic month follows the complete natural month', () => {
  assert.equal(normalizeTrafficMonth('2026-08'), '2026-08');
  assert.equal(normalizeTrafficMonth('2026-8'), null);
  assert.equal(normalizeTrafficMonth('2026-13'), null);
  assert.equal(trafficMonthDays('2026-08'), 31);
  assert.equal(trafficMonthDays('2026-02'), 28);
  assert.equal(trafficMonthDays('2028-02'), 29);
});

test('business date uses America/Los_Angeles rather than UTC', () => {
  assert.equal(trafficBusinessDate(new Date('2026-08-01T06:59:59.000Z')), '2026-07-31');
  assert.equal(trafficBusinessDate(new Date('2026-08-01T07:00:00.000Z')), '2026-08-01');
});

test('one authoritative distribution request writes one traffic event', async () => {
  let captured = null;
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          captured = { sql, args };
          return this;
        },
        async run() {
          return { success: true, meta: { changes: 1 } };
        },
      };
    },
  };

  await recordConversionTrafficEvent(db, {
    sectionId: 'section-1',
    productId: 'product-1',
    conversionGroupId: 'group-1',
    conversionTargetId: 'target-1',
    mode: 'link',
    outcome: 'redirected',
    requestId: 'ray-1',
    createdAt: '2026-08-15T12:00:00.000Z',
  });

  assert.match(captured.sql, /ON CONFLICT\(request_id\) DO NOTHING/u);
  assert.equal(captured.args.filter((value) => value === 'ray-1').length, 1);
  assert.equal(captured.args.at(-1), '2026-08-15');
});

test('monthly report returns billing totals in one response model', async () => {
  const db = {
    prepare(sql) {
      return {
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          assert.deepEqual(this.args, ['2026-08-01', '2026-09-01']);
          return {
            attempts: 12,
            delivered: 10,
            customer_service: 6,
            link_count: 4,
            failed: 2,
          };
        },
        async all() {
          assert.deepEqual(this.args, ['2026-08-01', '2026-09-01']);
          if (sql.includes('e.business_date,')) {
            return {
              results: [
                {
                  business_date: '2026-08-15',
                  attempts: 12,
                  delivered: 10,
                  customer_service: 6,
                  link_count: 4,
                  failed: 2,
                },
              ],
            };
          }
          if (sql.includes('recipient_id')) {
            return {
              results: [
                {
                  recipient_id: 'group-1',
                  recipient_name: 'Amy',
                  mode: 'customer_service',
                  section_name: 'Services',
                  group_name: 'Support',
                  attempts: 7,
                  delivered: 6,
                  customer_service: 6,
                  link_count: 0,
                  failed: 1,
                },
              ],
            };
          }
          return {
            results: [
              {
                product_id: 'product-1',
                product_title: 'Product One',
                section_name: 'Services',
                attempts: 12,
                delivered: 10,
                customer_service: 6,
                link_count: 4,
                failed: 2,
              },
            ],
          };
        },
      };
    },
  };

  const report = await getConversionTrafficReport(db, '2026-08');
  assert.equal(report.daysInMonth, 31);
  assert.deepEqual(report.totals, {
    attempts: 12,
    delivered: 10,
    customerService: 6,
    link: 4,
    failed: 2,
  });
  assert.equal(report.daily[0].date, '2026-08-15');
  assert.equal(report.recipients[0].recipientName, 'Amy');
  assert.equal(report.products[0].delivered, 10);
});
