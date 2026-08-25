import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('product titles stay centered from catalog cards into the detail first fold', () => {
  const polish = source('../src/catalog-polish.css');
  const detail = source('../src/product-detail-content-flow.css');
  const shared = source('../../../packages/storefront-ui/src/styles.css');

  assert.ok(
    polish.includes(
      ':is(.home-product-title, .browse-search-product-title, .section-product-title)',
    ),
  );
  assert.ok(polish.includes('text-align: center;'));
  assert.ok(polish.includes('.home-product-tile {\n  position: relative;'));
  assert.ok(shared.includes('.product-card-heading h3'));
  assert.ok(shared.includes('text-align: center;'));
  assert.ok(detail.includes('.product-detail-summary h1 {\n  text-align: center;'));
  assert.ok(
    detail.includes('.product-detail-page {\n    width: 100%;\n    margin-inline: 0;'),
  );
  assert.equal(
    detail.includes('margin-inline: calc(var(--v2-gutter, 16px) * -1)'),
    false,
  );
  assert.ok(detail.includes('border-radius: var(--theme-detail-media-radius'));
});

test('route-only support and section filter css stay out of storefront startup', () => {
  const main = source('../src/main.tsx');
  const messagesMedia = source('../src/messages-media.css');
  const filters = source('../src/SectionFilterControls.tsx');
  const root = source('../src/StorefrontRoot.tsx');
  const faq = source('../src/FaqPage.tsx');

  assert.equal(main.includes("import './chat-conversation.css';"), false);
  assert.equal(main.includes("import './section-compact-filters.css';"), false);
  assert.ok(messagesMedia.startsWith("@import './chat-conversation.css';"));
  assert.ok(filters.includes("import './section-compact-filters.css';"));
  assert.ok(root.includes("import('./MessagesPage')"));
  assert.ok(root.includes("import('./FaqPage')"));
  assert.ok(root.includes("import('./ProductDetailPage')"));
  assert.ok(faq.includes("import { MarkdownContent } from './MarkdownContent';"));
});
