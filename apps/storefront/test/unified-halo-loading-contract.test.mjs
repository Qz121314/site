import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('CTA, chat connection and Admin share one Halo Loading primitive', async () => {
  const [productDetail, supportUi, chatCss, adminApp, loadingCss] = await Promise.all([
    readFile(new URL('../src/ProductDetailPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/support-ui.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/chat-conversation.css', import.meta.url), 'utf8'),
    readFile(new URL('../../admin/src/App.tsx', import.meta.url), 'utf8'),
    readFile(
      new URL('../../../packages/storefront-ui/src/loading.css', import.meta.url),
      'utf8',
    ),
  ]);

  assert.match(productDetail, /<LoadingHalo size="small" \/>/u);
  assert.doesNotMatch(productDetail, /LoadingHaloOverlay/u);
  assert.doesNotMatch(productDetail, /product-detail-cta-spinner/u);

  assert.match(supportUi, /LoadingHalo/u);
  assert.match(supportUi, /className="chat-connection-state"/u);
  assert.match(chatCss, /\.chat-connection-state \{/u);

  assert.match(adminApp, /LoadingHalo/u);
  assert.doesNotMatch(adminApp, /loading-indicator/u);

  assert.match(loadingCss, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.doesNotMatch(loadingCss, /view-transition/u);
});
