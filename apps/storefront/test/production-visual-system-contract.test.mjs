import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('production acceptance stays runtime-theme-aware and guards stable storefront contracts', async () => {
  const [acceptance, main, theme, home, browse, section] = await Promise.all([
    readFile(
      new URL('../../../tests/e2e/production-smoke.spec.ts', import.meta.url),
      'utf8',
    ),
    readFile(new URL('../src/main.tsx', import.meta.url), 'utf8'),
    readFile(
      new URL('../../../packages/storefront-ui/src/theme-contract.css', import.meta.url),
      'utf8',
    ),
    readFile(new URL('../src/home-feed.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/browse-ui.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/section-ui.css', import.meta.url), 'utf8'),
  ]);

  assert.match(acceptance, /\/api\/public\/theme/u);
  assert.match(acceptance, /document\.documentElement\.dataset\.navigationStyle/u);
  assert.match(acceptance, /expectNoHorizontalOverflow/u);
  assert.match(acceptance, /\.home-shortcut-zone/u);
  assert.match(acceptance, /\.browse-directory-search/u);
  assert.match(acceptance, /\.section-catalog-search/u);
  assert.match(acceptance, /sectionContract\.searchHeight/u);
  assert.match(acceptance, /sectionContract\.coverRatio[\s\S]*toBeCloseTo\(1, 2\)/u);
  assert.match(acceptance, /\.messages-workspace/u);
  assert.match(acceptance, /\.storefront-route-action-host/u);
  assert.match(acceptance, /\.product-detail-route-action/u);
  assert.match(acceptance, /\.storefront-detail-topbar/u);
  assert.match(acceptance, /\.detail-mobile-media-track/u);
  assert.match(acceptance, /\.product-detail-secondary-media/u);
  assert.match(acceptance, /mediaContract\.scrollSnapType/u);
  assert.match(acceptance, /window\.visualViewport/u);
  assert.match(acceptance, /ctaContract\.visualBottomGap/u);
  assert.match(acceptance, /ctaContract\.runtimeHeightGap/u);
  assert.match(acceptance, /ctaContract\.buttonHeight/u);
  assert.match(acceptance, /ctaContract\.hostPosition/u);
  assert.match(acceptance, /headerContract\.visualTopGap/u);
  assert.match(acceptance, /headerContract\.runtimeHeightGap/u);
  assert.match(acceptance, /headerContract\.position/u);
  assert.doesNotMatch(acceptance, /body > \.product-detail-fixed-action/u);
  assert.doesNotMatch(acceptance, /\.toBe\('\d+(?:\.\d+)?px'\)/u);
  assert.doesNotMatch(acceptance, /boxShadow[\s\S]*\.toBe\('none'\)/u);
  assert.doesNotMatch(
    acceptance,
    /fontPack:\s*'editorial'|mediaStyle:\s*'soft'|motionStyle:\s*'restrained'|navigationStyle:\s*'quiet'/u,
  );

  assert.doesNotMatch(main, /conversion-polish\.css/u);
  assert.doesNotMatch(main, /media-layout-contract\.css/u);
  assert.doesNotMatch(main, /storefront-pages\.css/u);
  assert.doesNotMatch(main, /brand-bar\.css/u);
  assert.doesNotMatch(main, /bottom-navigation\.css/u);
  assert.doesNotMatch(theme, /theme-content-media-shadow/u);
  assert.doesNotMatch(theme, /\.home-product-cover/u);
  assert.doesNotMatch(theme, /\.browse-section-card/u);

  assert.match(home, /\.home-product-rail \{[\s\S]*grid-template-columns: repeat\(2,/u);
  assert.match(home, /\.home-product-cover,[\s\S]*aspect-ratio: 1 \/ 1;/u);
  assert.match(browse, /\.browse-section-card \{[\s\S]*aspect-ratio: 16 \/ 10;/u);
  assert.match(
    browse,
    /\.browse-directory-search \{[\s\S]*border-radius: var\(--theme-radius-control/u,
  );
  assert.match(
    browse,
    /\.browse-directory-search \{[\s\S]*var\(--v2-control-bg, var\(--surface-soft\)\)/u,
  );
  assert.match(
    section,
    /\.section-catalog-search \{[\s\S]*border-radius: var\(--theme-radius-control/u,
  );
  assert.match(
    section,
    /\.section-catalog-search \{[\s\S]*var\(--v2-control-bg, var\(--surface-soft\)\)/u,
  );
  assert.match(section, /\.section-product-cover \{[\s\S]*aspect-ratio: 1 \/ 1;/u);
});
