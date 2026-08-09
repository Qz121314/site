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

test('root path mounts Home while Browse and Messages use dedicated primary-page roots', () => {
  assert.match(mainSource, /<StorefrontRoot \/>/u);
  assert.match(rootSource, /parseStorefrontRoute\(pathname\)/u);
  assert.match(rootSource, /case 'home':\s*page = <HomeRoot \/>/u);
  assert.match(rootSource, /case 'discover':\s*page = <BrowseRoot \/>/u);
  assert.match(
    rootSource,
    /case 'messages':\s*page = <MessagesRoot activeConversationRef=\{null\} \/>/u,
  );
  assert.match(rootSource, /<HomeFeed bootstrap=\{bootstrapQuery\.data\} \/>/u);
});

test('Home is Hero then seven configured section shortcuts plus Browse More', () => {
  assert.match(feedSource, /<StorefrontHero/u);
  assert.match(feedSource, /shortcutSectionIds/u);
  assert.match(feedSource, /\.slice\(0, 7\)/u);
  assert.match(feedSource, /className="home-shortcut is-more" href="\/browse\/"/u);
  assert.match(
    feedSource,
    /<HomeShortcuts sections=\{shortcutSections\} moreLabel=\{copy\.home\.viewAll\} \/>/u,
  );
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

test('Home product covers stay square and recommendation rails are manual horizontal scrollers', () => {
  assert.match(cssSource, /aspect-ratio:\s*1 \/ 1/u);
  assert.match(cssSource, /\.home-product-rail[\s\S]*overflow-x:\s*auto/u);
  assert.match(cssSource, /scroll-snap-type:\s*x proximity/u);
  assert.doesNotMatch(feedSource, /setInterval/u);
  assert.match(cssSource, /grid-template-columns:\s*repeat\(4/u);
  assert.match(cssSource, /grid-template-columns:\s*repeat\(8/u);
});

test('Home layout is backend runtime config with seven and three item limits', () => {
  assert.match(layoutSource, /fetch\('\/api\/public\/home-layout\/'/u);
  assert.match(layoutSource, /parseSectionIds\(body\.layout\.shortcutSectionIds, 7\)/u);
  assert.match(
    layoutSource,
    /parseSectionIds\(body\.layout\.recommendationSectionIds, 3\)/u,
  );
});
