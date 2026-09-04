import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('storefront functional controls use shared icon button and Lucide icons', () => {
  const support = source('../src/support-ui.tsx');
  const pwa = source('../src/PwaInstallPrompt.tsx');
  const browse = source('../src/BrowsePage.tsx');
  const faq = source('../src/FaqPage.tsx');
  const filters = source('../src/SectionFilterControls.tsx');
  const section = source('../src/SectionPage.tsx');
  const product = source('../src/ProductDetailPage.tsx');
  const edgeNavigation = source('../src/MobileEdgeNavigation.tsx');
  const home = source('../src/HomeFeed.tsx');
  const root = source('../src/StorefrontRoot.tsx');
  const navigation = source('../src/storefront-navigation.tsx');

  assert.match(support, /from '@site\/storefront-ui\/icon-button'/u);
  assert.match(pwa, /from '@site\/storefront-ui\/icon-button'/u);
  assert.match(browse, /from '@site\/storefront-ui\/icon-button'/u);
  assert.match(filters, /from '@site\/storefront-ui\/icon-button'/u);

  for (const content of [
    support,
    pwa,
    browse,
    faq,
    filters,
    section,
    product,
    edgeNavigation,
    home,
    root,
    navigation,
  ]) {
    assert.match(content, /from 'lucide-react'/u);
  }

  assert.doesNotMatch(support, /[＋➤›]/u);
  assert.doesNotMatch(pwa, /<svg/u);
  assert.doesNotMatch(browse, /function (?:SearchIcon|ClearIcon|SectionArrowIcon)/u);
  assert.doesNotMatch(
    faq,
    /function (?:NavigationBackIcon|FaqStateIcon|MissingStateIcon)/u,
  );
  assert.doesNotMatch(filters, /function FilterIcon/u);
  assert.doesNotMatch(section, /function (?:SearchIcon|ClearIcon|BackIcon)/u);
  assert.doesNotMatch(product, /function LocationIcon|▶/u);
  assert.doesNotMatch(edgeNavigation, /[‹›]/u);
  assert.doesNotMatch(home, /function MoreIcon|›/u);
  assert.ok(home.includes('previousIcon={<ChevronLeft aria-hidden="true" />}'));
  assert.ok(home.includes('nextIcon={<ChevronRight aria-hidden="true" />}'));
  assert.ok(root.includes('locationIcon={<MapPin aria-hidden="true" />}'));
  assert.match(navigation, /function navigationIcon\(Icon: typeof House\)/u);
  assert.ok(
    navigation.includes('<Icon className="storefront-nav-svg" aria-hidden="true" />'),
  );
  assert.doesNotMatch(navigation, /<svg/u);
});
