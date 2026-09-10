import assert from 'node:assert/strict';
import test from 'node:test';
import { adminPageRoutes } from '../src/routes/admin-pages.ts';

function createDb() {
  let batchCalls = 0;
  return {
    get batchCalls() {
      return batchCalls;
    },
    prepare(sql) {
      return {
        bind() {
          return this;
        },
        async first() {
          if (sql.includes('FROM h5_page_versions')) return { id: 'version-1' };
          if (sql.includes('FROM conversion_groups')) return { id: 'group-1' };
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
      batchCalls += 1;
    },
  };
}

test('H5 page rejects CTAs with conflicting product routing', async () => {
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
  assert.equal((await response.json()).error.code, 'H5_PRODUCT_CONVERSION_CONFLICT');
  assert.equal(db.batchCalls, 0);
});
