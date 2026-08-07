import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProductDependencies } from '../src/products/products.ts';

test('published products may omit category and conversion group', async () => {
  const db = {
    prepare(sql) {
      return {
        sql,
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async first() {
          throw new Error(`Optional dependencies should not be queried: ${this.sql}`);
        },
        async all() {
          if (this.sql.includes('SELECT id FROM media_assets')) {
            return { results: [{ id: 'media-1' }] };
          }
          throw new Error(`Unexpected all SQL: ${this.sql}`);
        },
      };
    },
  };

  const result = await validateProductDependencies(db, 'section-1', {
    serviceMode: 'online',
    title: 'Product',
    body: 'Body',
    address: null,
    categoryId: null,
    conversionGroupId: null,
    coverAssetId: 'media-1',
    mediaAssetIds: ['media-1'],
    isFeatured: false,
    featuredOrder: 0,
    sortOrder: 0,
    status: 'published',
  });

  assert.deepEqual(result, { ok: true });
});
