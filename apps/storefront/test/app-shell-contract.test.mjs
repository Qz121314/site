import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mainSource = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const presentationSource = await readFile(
  new URL('../src/StorefrontPresentation.tsx', import.meta.url),
  'utf8',
);
const shellCss = await readFile(new URL('../src/app-shell.css', import.meta.url), 'utf8');
const pagesCss = await readFile(
  new URL('../src/storefront-pages.css', import.meta.url),
  'utf8',
);
const rootSource = await readFile(
  new URL('../src/StorefrontRoot.tsx', import.meta.url),
  'utf8',
);
const productSource = await readFile(
  new URL('../src/ProductDetailPage.tsx', import.meta.url),
  'utf8',
);
const productCss = await readFile(
  new URL('../src/product-detail-ui.css', import.meta.url),
  'utf8',
);
const faqSource = await readFile(new URL('../src/FaqPage.tsx', import.meta.url), 'utf8');

test('storefront loads the app shell refinement layer after PWA styles', () => {
  const pwaImport = mainSource.indexOf("import './pwa.css';");
  const shellImport = mainSource.indexOf("import './app-shell.css';");
  assert.ok(pwaImport >= 0, 'PWA styles must be loaded');
  assert.ok(shellImport > pwaImport, 'app shell overrides must load after PWA styles');
});

test('mobile app shell uses dynamic viewport height and one floating rounded dock', () => {
  assert.equal(shellCss.includes('100dvh'), true);
  assert.equal(shellCss.includes('.site-footer {\n    display: none;'), true);

  const mobileDockMatch = shellCss.match(
    /@media \(max-width: 767px\)[\s\S]*?\.app-shell \.bottom-nav \{(?<body>[^}]*)\}/u,
  );
  assert.ok(mobileDockMatch?.groups?.body, 'mobile bottom dock styles must exist');
  const mobileDockCss = mobileDockMatch.groups.body;

  assert.match(mobileDockCss, /right:\s*max\(8px, env\(safe-area-inset-right\)\);/u);
  assert.match(mobileDockCss, /bottom:\s*max\(7px, env\(safe-area-inset-bottom\)\);/u);
  assert.match(mobileDockCss, /left:\s*max\(8px, env\(safe-area-inset-left\)\);/u);
  assert.match(mobileDockCss, /width:\s*auto;/u);
  assert.match(mobileDockCss, /border-radius:\s*18px;/u);
  assert.match(mobileDockCss, /box-shadow:\s*0 12px 34px rgb\(31 35 40 \/ 12%\);/u);
  assert.match(mobileDockCss, /backdrop-filter:\s*blur\(18px\);/u);
  assert.doesNotMatch(mobileDockCss, /width:\s*100%/u);
  assert.doesNotMatch(mobileDockCss, /border-radius:\s*0/u);

  assert.doesNotMatch(pagesCss, /@media \(min-width:\s*720px\)/u);
  assert.match(pagesCss, /@media \(min-width:\s*768px\)/u);
});

test('primary tabs keep one mounted shell and use color-only active state', () => {
  assert.equal(rootSource.match(/<PrimaryShell\b/gu)?.length, 1);
  assert.match(rootSource, /className="storefront-route-view"/u);
  assert.match(rootSource, /routeKey=\{locationKey\}/u);
  assert.match(rootSource, /window\.location\.search/u);
  assert.match(
    shellCss,
    /\.app-shell \.bottom-nav a\.is-active \.bottom-nav-icon\s*\{[\s\S]*?background:\s*transparent;/u,
  );
  assert.doesNotMatch(shellCss, /@keyframes app-tab-settle/u);
});

test('storefront classifies secondary routes as push pages before paint', () => {
  assert.equal(
    mainSource.includes(
      "import { StorefrontPresentation } from './StorefrontPresentation';",
    ),
    true,
  );
  assert.equal(mainSource.includes('<StorefrontPresentation />'), true);
  assert.equal(presentationSource.includes('useLayoutEffect'), true);
  for (const routeType of [
    'section',
    'product',
    'faq-article',
    'message',
    'message-compose',
  ]) {
    assert.equal(
      presentationSource.includes(`case '${routeType}':`),
      true,
      `${routeType} must remain a push presentation`,
    );
  }
  assert.equal(presentationSource.includes('storefrontPresentation'), true);
  assert.equal(presentationSource.includes('storefrontTransition'), true);
});

test('mobile push content reuses the global dock unless the page owns the bottom action layer', () => {
  assert.equal(
    shellCss.includes("html[data-storefront-presentation='push'] .app-shell > .topbar"),
    true,
  );
  assert.equal(
    shellCss.includes(
      "html[data-storefront-presentation='push'] .app-shell > .bottom-nav",
    ),
    false,
  );
  assert.equal(
    shellCss.includes("html[data-storefront-presentation='push'] .app-shell > main"),
    true,
  );
  assert.match(
    shellCss,
    /@supports selector\(\.app-shell:has\(\.product-detail-page\)\)[\s\S]*?\.app-shell:has\(\.product-detail-page\)\s*\{[\s\S]*?padding-bottom:\s*0;/u,
  );
  assert.equal(shellCss.includes('safe-area-inset-top'), true);
  assert.equal(shellCss.includes("html[data-storefront-presentation='root']"), false);
});

test('mobile route transitions release fixed descendants back to the viewport', () => {
  assert.match(
    shellCss,
    /@keyframes app-page-enter-forward[\s\S]*?to\s*\{[\s\S]*?transform:\s*none;/u,
  );
  assert.match(
    shellCss,
    /@keyframes app-page-enter-back[\s\S]*?to\s*\{[\s\S]*?transform:\s*none;/u,
  );
  assert.doesNotMatch(
    shellCss,
    /@keyframes app-page-enter-(?:forward|back)[\s\S]*?to\s*\{[\s\S]*?transform:\s*translateX\(0\)/u,
  );
});

test('product detail owns the bottom action layer without the global tab bar', () => {
  assert.match(
    shellCss,
    /\.app-shell:has\(\.product-detail-page\) > \.bottom-nav\s*\{[\s\S]*?display:\s*none;/u,
  );
});

test('product and FAQ detail use history-aware push headers', () => {
  assert.equal(productSource.includes('product-detail-navigation'), true);
  assert.equal(productSource.includes('navigateStorefrontBack'), true);
  assert.equal(faqSource.includes('faq-article-navigation'), true);
  assert.equal(faqSource.includes('navigateStorefrontBack'), true);
  assert.equal(productCss.includes('.product-detail-navigation {'), true);
  assert.equal(productCss.includes('position: sticky;'), true);
  assert.equal(productCss.includes('.product-detail-fixed-action {'), true);
  assert.equal(productCss.includes('bottom: 0;'), true);
  assert.equal(productCss.includes('safe-area-inset-bottom'), true);
});

test('mobile conversation route remains focused full-screen UI without global chrome', () => {
  assert.equal(shellCss.includes('@media (max-width: 767px)'), true);
  assert.equal(
    shellCss.includes('.app-shell:has(.messages-workspace.is-thread-open) > .topbar'),
    true,
  );
  assert.equal(
    shellCss.includes('.app-shell:has(.messages-workspace.is-thread-open) > .bottom-nav'),
    true,
  );
  assert.equal(
    shellCss.includes('.app-shell:has(.messages-workspace.is-thread-open) > main'),
    true,
  );
  assert.equal(shellCss.includes('height: 100dvh;'), true);
  assert.equal(
    shellCss.includes(
      '.app-shell:has(.messages-workspace.is-thread-open) .chat-composer',
    ),
    true,
  );
  assert.equal(shellCss.includes('safe-area-inset-bottom'), true);
});
