import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
}

test('customer service CTA enters the chat shell before the handoff resolves', () => {
  const productDetail = source('../src/ProductDetailPage.tsx');
  const messagesPage = source('../src/MessagesPage.tsx');
  const supportUi = source('../src/support-ui.tsx');
  const cta = source('../src/cta.ts');
  const navigation = source('../src/storefront-navigation-runtime.ts');
  const workerConversion = source('../../worker/src/routes/public-conversion.ts');

  assert.doesNotMatch(productDetail, /resolveCustomerServiceCta/u);
  assert.match(productDetail, /ctaPath: cta\.path/u);
  assert.match(
    productDetail,
    /pushStorefrontLocation\(`\/messages\/new\/\?\$\{params\.toString\(\)\}`\)/u,
  );
  assert.match(
    productDetail,
    /\['support-compose-product', currentProduct\.sectionId, currentProduct\.id\]/u,
  );
  assert.match(productDetail, /window\.location\.assign\(cta\.path\)/u);

  assert.match(
    messagesPage,
    /resolveCustomerServiceCta\(composeContext\.ctaPath, signal\)/u,
  );
  assert.match(
    messagesPage,
    /\['support-compose-handoff', composeContext\?\.ctaPath\]/u,
  );
  assert.match(messagesPage, /parseResolvedComposePath\(path, composeContext\)/u);
  assert.match(
    messagesPage,
    /replaceStorefrontLocation\(`\/messages\/new\/\?\$\{params\.toString\(\)\}`\)/u,
  );

  assert.match(supportUi, /loadingConversation && pendingConversation && !conversation/u);
  assert.match(supportUi, /className="chat-connection-state"/u);
  assert.match(supportUi, /<LoadingHalo size="medium" \/>/u);

  assert.match(cta, /headers: \{ Accept: 'application\/json' \}/u);
  assert.match(cta, /value\.path\.startsWith\('\/messages\/new\/'\)/u);
  assert.match(navigation, /window\.history\.pushState\(null, '',/u);
  assert.match(navigation, /target\.pathname === '\/messages\/'/u);
  assert.match(navigation, /navigateStorefrontBack\(\)/u);

  assert.match(workerConversion, /context\.req\.header\('accept'\)/u);
  assert.match(workerConversion, /return context\.json\(\{ path \}\)/u);
  assert.match(workerConversion, /return context\.redirect\(path, 302\)/u);
});
