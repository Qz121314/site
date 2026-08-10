import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mainSource = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const presentationSource = await readFile(
  new URL('../src/StorefrontPresentation.tsx', import.meta.url),
  'utf8',
);
const shellCss = await readFile(new URL('../src/app-shell.css', import.meta.url), 'utf8');
const productSource = await readFile(new URL('../src/ProductDetailPage.tsx', import.meta.url), 'utf8');
const productCss = await readFile(new URL('../src/product-detail-ui.css', import.meta.url), 'utf8');
const faqSource = await readFile(new URL('../src/FaqPage.tsx', import.meta.url), 'utf8');

test('storefront loads the app shell refinement layer after PWA styles', () => {
  const pwaImport = mainSource.indexOf("import './pwa.css';");
  const shellImport = mainSource.indexOf("import './app-shell.css';");
  assert.ok(pwaImport >= 0, 'PWA styles must be loaded');
  assert.ok(shellImport > pwaImport, 'app shell overrides must load after PWA styles');
});

test('mobile app shell uses dynamic viewport height and a non-floating tab bar', () => {
  assert.match(shellCss, /100dvh/u);
  assert.match(shellCss, /\.site-footer\s*\{\s*display:\s*none;/u);
  assert.match(shellCss, /\.app-shell \.bottom-nav\s*\{[\s\S]*?border-radius:\s*0;/u);
});

test('storefront classifies secondary routes as push pages before paint', () => {
  assert.match(mainSource, /import \{ StorefrontPresentation \}/u);
  assert.match(mainSource, /<StorefrontPresentation \/>/u);
  assert.match(presentationSource, /useLayoutEffect/u);
  for (const routeType of ['section', 'product', 'faq-article', 'message', 'message-compose']) {
    assert.equal(
      presentationSource.includes(`case '${routeType}':`),
      true,
      `${routeType} must remain a push presentation`,
    );
  }
  assert.match(presentationSource, /storefrontPresentation/u);
});

test('mobile push pages remove root chrome while root tabs keep it', () => {
  assert.match(shellCss, /data-storefront-presentation='push'/u);
  assert.match(shellCss, /data-storefront-presentation='push'[\s\S]*?> \.topbar/u);
  assert.match(shellCss, /data-storefront-presentation='push'[\s\S]*?> \.bottom-nav/u);
  assert.match(shellCss, /data-storefront-presentation='push'[\s\S]*?> main\s*\{[\s\S]*?safe-area-inset-top/u);
  assert.doesNotMatch(shellCss, /data-storefront-presentation='root'[\s\S]*?display:\s*none/u);
});

test('product and FAQ detail use history-aware push headers', () => {
  assert.match(productSource, /product-detail-navigation/u);
  assert.match(productSource, /navigateStorefrontBack/u);
  assert.match(faqSource, /faq-article-navigation/u);
  assert.match(faqSource, /navigateStorefrontBack/u);
  assert.match(productCss, /\.product-detail-navigation\s*\{[\s\S]*?position:\s*sticky;/u);
  assert.match(productCss, /\.product-detail-mobile-action\s*\{[\s\S]*?bottom:\s*0;/u);
  assert.match(productCss, /safe-area-inset-bottom/u);
});

test('mobile conversation route remains focused full-screen UI without global chrome', () => {
  assert.match(shellCss, /@media \(max-width:\s*767px\)/u);
  assert.match(shellCss, /\.app-shell:has\(\.messages-workspace\.is-thread-open\) > \.topbar/u);
  assert.match(shellCss, /\.app-shell:has\(\.messages-workspace\.is-thread-open\) > \.bottom-nav/u);
  assert.match(shellCss, /\.app-shell:has\(\.messages-workspace\.is-thread-open\) > main\s*\{[\s\S]*?height:\s*100dvh;/u);
  assert.match(shellCss, /\.app-shell:has\(\.messages-workspace\.is-thread-open\) \.chat-composer\s*\{[\s\S]*?safe-area-inset-bottom/u);
  assert.doesNotMatch(shellCss, /@media \(min-width:\s*768px\)[\s\S]*?> \.bottom-nav\s*\{\s*display:\s*none/u);
});
