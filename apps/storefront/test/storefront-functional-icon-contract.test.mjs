import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('storefront functional controls keep shared icon dependencies instead of page-owned icon implementations', () => {
  const support = source('../src/support-ui.tsx');
  const pwa = source('../src/PwaInstallPrompt.tsx');
  const browse = source('../src/BrowsePage.tsx');
  const filters = source('../src/SectionFilterControls.tsx');
  const section = source('../src/SectionPage.tsx');
  const product = source('../src/ProductDetailPage.tsx');
  const home = source('../src/HomeFeed.tsx');
  const root = source('../src/StorefrontRoot.tsx');
  const navigation = source('../src/storefront-navigation.tsx');

  for (const content of [support, pwa, browse, filters]) {
    assert.match(content, /from '@site\/storefront-ui\/icon-button'/u);
  }

  for (const content of [support, pwa, browse, filters, section, product, home, root, navigation]) {
    assert.match(content, /from 'lucide-react'/u);
  }

  for (const content of [support, pwa, browse, section, product, home, navigation]) {
    assert.doesNotMatch(content, /<svg/u);
  }
});
