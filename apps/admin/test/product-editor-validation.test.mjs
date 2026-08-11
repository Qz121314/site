import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProductDraft } from '../src/product-management/product-editor-validation.ts';

function productForm(overrides = {}) {
  return {
    serviceMode: 'online',
    title: '示例产品',
    body: '产品正文',
    address: null,
    categoryId: null,
    tagIds: [],
    conversionGroupId: null,
    coverAssetId: null,
    mediaAssetIds: [],
    isFeatured: false,
    featuredOrder: 0,
    sortOrder: 0,
    status: 'draft',
    ...overrides,
  };
}

function media(mimeType = 'image/webp') {
  return {
    kind: 'remote',
    key: `remote:${mimeType}`,
    media: { mimeType },
  };
}

function category(id, isEnabled = true) {
  return { id, isEnabled };
}

function tag(id, isEnabled = true) {
  return { id, isEnabled };
}

function group(id, mode, overrides = {}) {
  return {
    id,
    mode,
    isEnabled: true,
    activeTargetCount: 1,
    ...overrides,
  };
}

function validate(form, options = {}) {
  return validateProductDraft(
    form,
    options.media ?? [],
    options.categories ?? [],
    options.tags ?? [],
    options.groups ?? [],
  );
}

test('drafts require core content but can be saved before publish dependencies are ready', () => {
  assert.equal(validate(productForm({ title: '  ' })), '请填写产品标题。');
  assert.equal(validate(productForm({ body: '\n' })), '请填写产品正文。');
  assert.equal(
    validate(productForm({ categoryId: 'missing', conversionGroupId: 'missing' })),
    null,
  );
});

test('a complete online product can be published', () => {
  assert.equal(
    validate(
      productForm({
        status: 'published',
        categoryId: 'category-1',
        tagIds: ['tag-1'],
        conversionGroupId: 'group-1',
      }),
      {
        media: [media()],
        categories: [category('category-1')],
        tags: [tag('tag-1')],
        groups: [group('group-1', 'link')],
      },
    ),
    null,
  );
});

test('published products reject unavailable classifications and excessive tags', () => {
  const published = productForm({ status: 'published', categoryId: 'category-1' });
  assert.equal(validate(published, { media: [media()] }), '所选分类不存在或已停用。');
  assert.equal(
    validate(published, {
      media: [media()],
      categories: [category('category-1', false)],
    }),
    '所选分类不存在或已停用。',
  );
  assert.equal(
    validate(productForm({ status: 'published', tagIds: ['tag-1'] }), {
      media: [media()],
    }),
    '发布产品不能使用已停用或不存在的标签。',
  );
  assert.equal(
    validate(productForm({ status: 'published', tagIds: ['tag-1'] }), {
      media: [media()],
      tags: [tag('tag-1', false)],
    }),
    '发布产品不能使用已停用或不存在的标签。',
  );
  assert.equal(
    validate(
      productForm({ tagIds: Array.from({ length: 13 }, (_, index) => `tag-${index}`) }),
    ),
    '每个产品最多选择 12 个标签。',
  );
});

test('conversion groups must match the product mode and have an active target', () => {
  const online = productForm({ status: 'published', conversionGroupId: 'group-1' });
  const offline = productForm({
    serviceMode: 'offline',
    status: 'published',
    address: '服务地址',
    conversionGroupId: 'group-1',
  });

  assert.equal(
    validate(online, {
      media: [media()],
      groups: [group('group-1', 'customer_service')],
    }),
    '所选转化分组必须是启用的外部链接分组。',
  );
  assert.equal(
    validate(online, {
      media: [media()],
      groups: [group('group-1', 'link', { isEnabled: false })],
    }),
    '所选转化分组必须是启用的外部链接分组。',
  );
  assert.equal(
    validate(offline, { media: [media()], groups: [group('group-1', 'link')] }),
    '所选转化分组必须是启用的在线客服分组。',
  );
  assert.equal(
    validate(online, {
      media: [media()],
      groups: [group('group-1', 'link', { activeTargetCount: 0 })],
    }),
    '所选转化分组至少需要一个启用入口。',
  );
});

test('published products require cover-eligible media without requiring an offline address', () => {
  const publishedOnline = productForm({ status: 'published' });
  assert.equal(validate(publishedOnline), '发布产品前至少需要一个产品媒体。');
  assert.equal(
    validate(publishedOnline, { media: [media('video/mp4')] }),
    '发布产品前至少需要一张图片或 GIF 作为封面。',
  );
  assert.equal(
    validate(
      productForm({ serviceMode: 'offline', status: 'published', address: null }),
      {
        media: [media('image/gif')],
      },
    ),
    null,
  );
});
