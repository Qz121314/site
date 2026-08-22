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
  const [artDirection, primaryArtDirection, homeSource, storefrontMain, adminMain] =
    await Promise.all([
      readFile(
        new URL(
          '../../../packages/storefront-ui/src/art-direction-contract.css',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(
        new URL(
          '../../../packages/storefront-ui/src/art-direction-primary-surfaces.css',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(new URL('../src/HomeFeed.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/main.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../../admin/src/main.tsx', import.meta.url), 'utf8'),
    ]);

  for (const styles of [home, hero, browse, section, faq, messages, pwa]) {
    assert.doesNotMatch(styles, /max\(var\(--theme-radius/u);
  }

  assert.match(shell, /\.app-shell \.brand-lockup[\s\S]*margin-inline: auto/u);
  assert.match(shell, /\.app-shell > \.topbar \{[\s\S]*position: fixed/u);
  assert.match(shell, /\.storefront-bottom-chrome \{[\s\S]*position: fixed/u);
  assert.match(shell, /backdrop-filter: blur\(22px\)/u);
  assert.match(shell, /\.app-shell \.brand-logo \{[\s\S]*width: min\(/u);
  assert.doesNotMatch(
    shell,
    /\.storefront-route-action-host \{[\s\S]{0,220}position: fixed/u,
  );
  assert.match(
    shell,
    /\.storefront-bottom-chrome \{[\s\S]*bottom: var\(--app-viewport-bottom/u,
  );
  assert.match(shell, /var\(--app-header-height/u);
  assert.match(shell, /var\(--app-bottom-chrome-height/u);
  assert.doesNotMatch(shell, /var\(--app-route-action-height/u);
  assert.doesNotMatch(shell, /var\(--app-bottom-nav-height/u);
  assert.match(shell, /\.storefront-detail-topbar \{/u);
  assert.match(shell, /\.storefront-detail-back \{/u);
  assert.doesNotMatch(
    shell,
    /html\[data-storefront-presentation='push'\]\s+\.app-shell > \.topbar/u,
  );
  assert.match(
    shell,
    /\.storefront-bottom-chrome > \.bottom-nav a\.is-active \{[\s\S]*background: transparent/u,
  );
  assert.match(
    shell,
    /\.storefront-bottom-chrome > \.bottom-nav a\.is-active \.bottom-nav-icon \{[\s\S]*background: color-mix/u,
  );

  assert.match(hero, /\.hero-carousel-copy :is\(h1, h2\)/u);
  assert.match(home, /\.home-product-rail \{[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(home, /\.home-product-title \{[\s\S]*position: absolute/u);
  assert.match(home, /\.home-recommendation-heading > a \{[\s\S]*border-radius: 50%/u);
  assert.doesNotMatch(
    home,
    /\.app-shell:has\(\.home-feed\)\s*>\s*main\s*\{[\s\S]{0,120}padding-top:\s*0/u,
  );

  assert.match(artDirection, /--theme-art-text-primary/u);
  assert.match(artDirection, /--theme-art-media-filter/u);
  assert.match(artDirection, /\[data-font-pack='editorial'\]/u);
  assert.match(artDirection, /\[data-media-style='editorial'\]/u);
  assert.match(artDirection, /\[data-motion-style='gentle'\]/u);
  assert.match(artDirection, /\[data-theme='travel'\][\s\S]*text-align: center/u);
  assert.match(artDirection, /\[data-theme='noir'\][\s\S]*\.home-product-meta/u);
  assert.match(artDirection, /storefront-hero-image-settle/u);
  assert.match(artDirection, /prefers-reduced-motion: reduce/u);
  assert.match(primaryArtDirection, /\.browse-section-card-scrim/u);
  assert.match(primaryArtDirection, /\.browse-search-product-title/u);
  assert.match(primaryArtDirection, /\.section-product-title/u);
  assert.match(primaryArtDirection, /\.product-detail-summary h1/u);
  assert.match(primaryArtDirection, /\.detail-media-stage > img/u);
  assert.match(primaryArtDirection, /var\(--theme-art-hero-overlay\)/u);
  assert.match(primaryArtDirection, /var\(--theme-art-media-filter\)/u);
  assert.match(primaryArtDirection, /var\(--theme-art-heading-weight\)/u);
  assert.doesNotMatch(primaryArtDirection, /--theme-art-[\w-]+\s*:/u);
  assert.match(
    homeSource,
    /hero-carousel-slide\$\{index === activeIndex \? ' is-active' : ''\}/u,
  );
  assert.match(homeSource, /className="home-product-meta"/u);
  assert.match(homeSource, /className="home-product-context"/u);
  assert.match(storefrontMain, /@site\/storefront-ui\/art-direction-contract\.css/u);
  assert.match(
    storefrontMain,
    /@site\/storefront-ui\/art-direction-primary-surfaces\.css/u,
  );
  assert.match(adminMain, /@site\/storefront-ui\/art-direction-contract\.css/u);

  assert.match(
    browse,
    /\.browse-search-products \{[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/u,
  );
  assert.match(browse, /\.browse-search-product-cover \{[\s\S]*aspect-ratio: 1 \/ 1/u);
  assert.match(
    section,
    /\.section-catalog-products \{[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/u,
  );
  assert.match(section, /\.section-product-cover \{[\s\S]*aspect-ratio: 1 \/ 1/u);

  assert.match(faq, /\.faq-article-body/u);
  assert.match(shared, /\.state-mark \{/u);

  assert.match(messages, /grid-template-columns: 40px minmax\(0, 1fr\) 40px/u);
  assert.match(
    messages,
    /\.chat-composer \.chat-send-button \{[\s\S]*width: 40px;[\s\S]*height: 40px/u,
  );
  assert.match(
    shell,
    /\.app-shell:has\(\.messages-workspace\.is-thread-open\) \.chat-composer/u,
  );

  assert.match(detail, /\.product-detail-route-action \{/u);
  assert.doesNotMatch(
    detail,
    /\.product-detail-route-action \{[\s\S]{0,240}position: fixed/u,
  );
  assert.match(
    detailFlow,
    /\.detail-mobile-media-track \{[\s\S]*scroll-snap-type: x mandatory/u,
  );
  assert.match(detailFlow, /\.detail-mobile-media-count \{/u);
  assert.doesNotMatch(detailFlow, /\.product-detail-secondary-media \{/u);

  assert.match(pwa, /var\(--app-viewport-bottom/u);
  assert.match(pwa, /var\(--app-bottom-chrome-height/u);
  assert.doesNotMatch(pwa, /var\(--app-bottom-nav-height/u);
  assert.match(pwa, /\.pwa-install-card/u);
});
