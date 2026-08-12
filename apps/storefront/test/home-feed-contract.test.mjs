import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootSource = await readFile(
  new URL('../src/StorefrontRoot.tsx', import.meta.url),
  'utf8',
);
const feedSource = await readFile(
  new URL('../src/HomeFeed.tsx', import.meta.url),
  'utf8',
);
const layoutSource = await readFile(
  new URL('../src/home-layout.ts', import.meta.url),
  'utf8',
);
const cssSource = await readFile(
  new URL('../src/home-feed.css', import.meta.url),
  'utf8',
);
const mainSource = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');

test('primary tabs switch content inside one persistent app shell', () => {
  assert.match(mainSource, /<StorefrontRoot \/>/u);
  assert.match(rootSource, /parseStorefrontRoute\(pathname\)/u);
  assert.equal(rootSource.match(/<PrimaryShell\b/gu)?.length, 1);
  assert.match(rootSource, /routeKey=\{locationKey\}/u);
  assert.match(rootSource, /pathnameFromLocationKey\(locationKey\)/u);
  assert.match(
    rootSource,
    /case 'home':\s*page = <HomeFeed bootstrap=\{bootstrap\} \/>/u,
  );
  assert.match(rootSource, /case 'discover':[\s\S]*?<BrowsePage/u);
  assert.match(
    rootSource,
    /case 'messages':[\s\S]*?<MessagesPage[\s\S]*?activeConversationRef=\{null\}/u,
  );
  assert.match(rootSource, /<main>[\s\S]*className="storefront-route-view"/u);
});

test('Home starts with seven configured section shortcuts plus Browse More', () => {
  assert.doesNotMatch(feedSource, /StorefrontHero|HeroMedia|ResilientVideo/u);
  assert.match(feedSource, /shortcutSectionIds/u);
  assert.match(feedSource, /\.slice\(0, 7\)/u);
  assert.match(feedSource, /className="home-shortcut is-more" href="\/browse\/"/u);
  assert.match(
    feedSource,
    /className="home-shortcuts home-shortcut-hero"/u,
  );
  assert.match(feedSource, /<HomeShortcuts sections=\{shortcutSections\} \/>/u);
  assert.match(feedSource, /\{SYSTEM_UI\.more\}/u);
  assert.doesNotMatch(feedSource, /copy\.home\.viewAll|moreLabel/u);
  assert.doesNotMatch(feedSource, /type="search"/u);
});

test('Home renders at most three section recommendation rails from explicitly featured products', () => {
  assert.match(feedSource, /recommendationSectionIds/u);
  assert.match(feedSource, /\.slice\(0, 3\)/u);
  assert.match(feedSource, /\.filter\(\(product\) => product\.isFeatured\)/u);
  assert.match(feedSource, /left\.featuredOrder - right\.featuredOrder/u);
  assert.match(feedSource, /href=\{sectionHref\(section\)\}/u);
  assert.match(feedSource, /href=\{productHref\(product\)\}/u);
});

test('Home uses floating shortcuts and compact manual product rails', () => {
  assert.match(cssSource, /aspect-ratio:\s*1 \/ 1/u);
  assert.match(cssSource, /\.home-product-rail[\s\S]*overflow-x:\s*auto/u);
  assert.match(cssSource, /scroll-snap-type:\s*x proximity/u);
  assert.doesNotMatch(feedSource, /setInterval/u);
  assert.match(cssSource, /\.home-shortcuts\s*\{[\s\S]*?display:\s*flex;/u);
  assert.match(cssSource, /\.home-shortcut\s*\{[\s\S]*?min-width:\s*62px;/u);
  assert.match(
    cssSource,
    /\.home-shortcut-icon\s*\{[\s\S]*?box-shadow:[\s\S]*?transform:\s*translateY\(-2px\)/u,
  );
  assert.match(
    cssSource,
    /\.home-product-rail\s*\{[\s\S]*?grid-auto-columns:\s*clamp\(126px,\s*40\.5vw,\s*176px\)/u,
  );
  assert.doesNotMatch(cssSource, /\.home-product-rail\.is-single/u);
  assert.doesNotMatch(feedSource, /home-product-arrow|ProductArrowIcon/u);
  assert.match(feedSource, /home-product-meta/u);
});

test('Home uses tighter mobile app chrome without changing other primary pages', () => {
  assert.match(
    cssSource,
    /\.app-shell:has\(\.home-feed\) > \.topbar\s*\{[\s\S]*?min-height:\s*calc\(54px \+ env\(safe-area-inset-top\)\)/u,
  );
  assert.match(
    cssSource,
    /\.app-shell:has\(\.home-feed\) > main\s*\{[\s\S]*?padding-top:\s*6px/u,
  );
  assert.match(
    cssSource,
    /\.app-shell:has\(\.home-feed\) \.brand-logo\s*\{[\s\S]*?width:\s*32px;[\s\S]*?height:\s*32px/u,
  );
});

test('Home layout comes from the published Site snapshot with published-content auto mode', () => {
  assert.doesNotMatch(layoutSource, /fetch\(/u);
  assert.doesNotMatch(feedSource, /loadHomeLayout|storefront-home-layout/u);
  assert.match(layoutSource, /resolveHomeLayout/u);
  assert.match(feedSource, /site\.homeLayout/u);
  assert.match(feedSource, /fallbackRecommendationSectionIds\(bootstrap\)/u);
  assert.match(feedSource, /resolveHomeLayout\(/u);
});
