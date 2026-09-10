import assert from 'node:assert/strict';
import test from 'node:test';
import { adminPageRoutes } from '../src/routes/admin-pages.ts';

function createDb() {
  let batchCalled = false;
  return {
    get batchCalled() {
      return batchCalled;
    },
    prepare(sql) {
      let params = [];
      return {
        bind(...values) {
          params = values;
          return this;
        },
        async first() {
          if (sql.includes('FROM h5_page_versions')) return { id: 'version-1' };
          if (sql.includes('FROM conversion_groups')) {
            return {
              id: params[1],
              mode: 'customer_service',
              customer_service_connection_id:
                params[1] === 'group-a' ? 'connection-a' : 'connection-b',
            };
          }
          throw new Error(`Unexpected first SQL: ${sql}`);
        },
        async all() {
          if (sql.includes('FROM h5_page_ctas')) {
            return { results: [{ id: 'cta-a' }, { id: 'cta-b' }] };
          }
          throw new Error(`Unexpected all SQL: ${sql}`);
        },
      };
    },
    async batch() {
      batchCalled = true;
    },
  };
}

test('H5 customer-service CTAs cannot give one page conflicting catalog owners', async () => {
  const db = createDb();
  const response = await adminPageRoutes.request(
    'https://site.example.com/page-1/ctas',
    {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-admin-request': '1',
      },
      body: JSON.stringify({
        versionId: 'version-1',
        bindings: [
          {
            ctaId: 'cta-a',
            label: 'Talk now',
            sectionId: 'section-a',
            conversionGroupId: 'group-a',
          },
          {
            ctaId: 'cta-b',
            label: 'Talk later',
            sectionId: 'section-b',
            conversionGroupId: 'group-b',
          },
        ],
      }),
    },
    { DB: db },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'H5_SUPPORT_OWNER_CONFLICT',
      message: '同一落地页的在线客服 CTA 必须属于同一个分区和客服连接。',
    },
  });
  assert.equal(db.batchCalled, false);
});
