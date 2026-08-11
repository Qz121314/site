import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const editorSource = await readFile(
  new URL('../../admin/src/product-management/ProductEditorDialog.tsx', import.meta.url),
  'utf8',
);
const adminValidationSource = await readFile(
  new URL('../../admin/src/product-management/product-editor-validation.ts', import.meta.url),
  'utf8',
);
const productDomainSource = await readFile(
  new URL('../../worker/src/products/products.ts', import.meta.url),
  'utf8',
);
const publisherSource = await readFile(
  new URL('../../worker/src/publishing/modular-publisher.ts', import.meta.url),
  'utf8',
);
const detailSource = await readFile(
  new URL('../src/ProductDetailPage.tsx', import.meta.url),
  'utf8',
);

test('offline products use the product body for location details instead of a dedicated address field', () => {
  assert.doesNotMatch(editorSource, /product-core-address/);
  assert.doesNotMatch(editorSource, /服务地址/);
  assert.doesNotMatch(adminValidationSource, /必须填写服务地址/);
  assert.doesNotMatch(productDomainSource, /ADDRESS_REQUIRED/);
  assert.doesNotMatch(publisherSource, /PRODUCT_ADDRESS_REQUIRED/);
  assert.doesNotMatch(detailSource, /product\.address/);
});
