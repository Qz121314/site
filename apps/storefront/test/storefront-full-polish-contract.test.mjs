import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const styleFiles = [
  '../src/app-shell.css',
  '../src/styles.css',
  '../src/hero-carousel.css',
  '../src/home-feed.css',
  '../src/browse-ui.css',
  '../src/section-ui.css',
  '../src/faq-ui.css',
  '../src/messages-ui.css',
  '../src/product-detail-ui.css',
  '../src/product-detail-content-flow.css',
  '../src/pwa.css',
];

test('storefront polish stays theme-led and app-native across every primary surface', async () => {
  const [
    shell,
    shared,
    hero,
    home,
    browse,
    section,
    faq,
    messages,
    detail,
    detailFlow,
    pwa,
  ] = await Promise.all(
    styleFiles.map((path) => readFile(new URL(path, import.meta.url), 'utf8')),
  );

  for (const styles of [home, hero, browse, section, faq, messages, pwa]) {
    assert.doesNotMatch(styles, /max\(var\(--theme-radius/u);
  }

  assert.match(shell, /\.app-shell \.brand-lockup[\s\S]*margin-inline: auto/u);
  assert.match(shell, /\.app-shell > \.bottom-nav \{[\s\S]*position: fixed/u);
  assert.match(shell, /backdrop-filter: blur\(22px\)/u);

  assert.match(hero, /\.hero-carousel-copy :is\(h1, h2\)/u);
  assert.match(home, /\.home-product-rail \{[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(home, /\.home-product-title \{[\s\S]*position: absolute/u);

  assert.match(browse, /\.browse-search-products \{[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(browse, /\.browse-search-product-cover \{[\s\S]*aspect-ratio: 1 \/ 1/u);
  assert.match(section, /\.section-catalog-products \{[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(section, /\.section-product-cover \{[\s\S]*aspect-ratio: 1 \/ 1/u);

  assert.match(faq, /\.faq-article-body/u);
  assert.match(shared, /\.state-mark \{/u);

  assert.match(messages, /grid-template-columns: 40px minmax\(0, 1fr\) 40px/u);
  assert.match(messages, /\.chat-composer \.chat-send-button \{[\s\S]*width: 40px;[\s\S]*height: 40px/u);
  assert.match(shell, /\.app-shell:has\(\.messages-workspace\.is-thread-open\) \.chat-composer/u);

  assert.match(detail, /\.product-detail-fixed-action \{[\s\S]*position: fixed/u);
  assert.match(detail, /\.product-detail-fixed-action \{[\s\S]*bottom: 0/u);
  assert.match(detailFlow, /\.product-detail-secondary-media \{/u);

  assert.match(pwa, /env\(safe-area-inset-bottom\)/u);
  assert.match(pwa, /\.pwa-install-card/u);
});
