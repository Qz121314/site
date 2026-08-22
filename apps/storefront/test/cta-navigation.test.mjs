import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
}

function contains(value, fragment) {
  assert.ok(value.includes(fragment), `Missing contract: ${fragment}`);
}

test('customer service CTA opens chat before handoff', () => {
  const productDetail = source('../src/ProductDetailPage.tsx');
  const messagesPage = source('../src/MessagesPage.tsx');
  const supportUi = source('../src/support-ui.tsx');
  const cta = source('../src/cta.ts');
  const navigation = source('../src/storefront-navigation-runtime.ts');
  const workerConversion = source('../../worker/src/routes/public-conversion.ts');

  assert.ok(!productDetail.includes('resolveCustomerServiceCta'));
  assert.ok(!productDetail.includes('LoadingHaloOverlay'));
  assert.ok(!productDetail.includes('ctaNavigating'));
  contains(productDetail, 'ctaPath: cta.path');
  contains(productDetail, 'pushStorefrontLocation(');
  contains(productDetail, '/messages/new/?');
  contains(productDetail, "'support-compose-product'");
  contains(productDetail, 'window.location.assign(cta.path)');

  contains(messagesPage, 'resolveCustomerServiceCta(');
  contains(messagesPage, 'composeContext.ctaPath');
  contains(messagesPage, "'support-compose-handoff'");
  contains(messagesPage, 'parseResolvedComposePath(path, composeContext)');
  contains(messagesPage, 'replaceStorefrontLocation(');

  contains(supportUi, 'loadingConversation && pendingConversation');
  contains(supportUi, 'chat-connection-state');
  contains(supportUi, '<LoadingHalo size="medium" />');

  contains(cta, "Accept: 'application/json'");
  contains(cta, "value.path.startsWith('/messages/new/')");
  contains(navigation, 'window.history.pushState(null');
  contains(navigation, "target.pathname === '/messages/'");
  contains(navigation, 'navigateStorefrontBack()');

  contains(workerConversion, "context.req.header('accept')");
  contains(workerConversion, 'return context.json({ path })');
  contains(workerConversion, 'return context.redirect(path, 302)');
});
