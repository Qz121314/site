import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import { parseSupportProductContext } from '../src/support-product-context.ts';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const snapshot = {
  productId: 'product-1',
  title: 'Snapshot Product',
  coverUrl: 'https://example.com/product.webp',
  href: 'https://example.com/products/product-1',
  sectionId: 'section-1',
  sectionName: 'Section',
  categoryId: 'category-1',
  categoryName: 'Category',
};

test('product context parser preserves the complete customer-service snapshot', () => {
  assert.deepEqual(parseSupportProductContext(snapshot), snapshot);
  assert.equal(parseSupportProductContext({ ...snapshot, title: null }), null);
  assert.equal(parseSupportProductContext({ ...snapshot, categoryName: 7 }), null);
});

test('history and realtime share snapshot validation before timeline rendering', () => {
  const gateway = source('../src/support-gateway.ts');
  const realtime = source('../src/support-realtime.ts');
  const ui = source('../src/support-ui.tsx');
  const styles = source('../src/chat-conversation.css');

  assert.ok(gateway.includes('parseSupportProductContext(item.productContext)'));
  assert.ok(realtime.includes('parseSupportProductContext(item.productContext)'));
  assert.ok(ui.includes("message.kind === 'product_context' && message.productContext"));
  assert.ok(ui.includes('<ProductContextMessageCard'));
  assert.ok(ui.includes('context.sectionName, context.categoryName'));
  assert.ok(styles.includes('.chat-product-message-card'));
  assert.ok(styles.includes('.chat-product-message-media img'));
});

test('the persistent top product card is replaced by timeline product messages', () => {
  const ui = source('../src/support-ui.tsx');
  assert.match(
    ui,
    /\{pendingConversation \? \([\s\S]*?<ProductContextCard[\s\S]*?\) : null\}/u,
  );
});
