import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const storefrontMain = await readFile(
  new URL('../src/main.tsx', import.meta.url),
  'utf8',
);
const contentUi = await readFile(
  new URL('../src/content-ui.css', import.meta.url),
  'utf8',
);
const themeRuntime = await readFile(
  new URL('../src/theme-runtime.ts', import.meta.url),
  'utf8',
);
const sharedContract = await readFile(
  new URL('../../../packages/storefront-ui/src/theme-contract.css', import.meta.url),
  'utf8',
);
const sharedPackage = JSON.parse(
  await readFile(
    new URL('../../../packages/storefront-ui/package.json', import.meta.url),
    'utf8',
  ),
);
const adminMain = await readFile(
  new URL('../../admin/src/main.tsx', import.meta.url),
  'utf8',
);
const themeCenterView = await readFile(
  new URL('../../admin/src/ThemeCenterView.tsx', import.meta.url),
  'utf8',
);

test('storefront runtime consumes versioned Theme Center UI recipes', () => {
  assert.match(
    themeRuntime,
    /type ThemeDensity = 'compact' \| 'standard' \| 'comfortable';/u,
  );
  assert.match(themeRuntime, /root\.dataset\.density = theme\.density;/u);
  assert.match(themeRuntime, /storefront-theme-v4/u);
  assert.match(themeRuntime, /recipe:\s*ThemeRecipe/u);
  assert.match(themeRuntime, /root\.dataset\.fontPack = theme\.recipe\.fontPack/u);
  assert.match(themeRuntime, /root\.dataset\.buttonStyle = theme\.recipe\.buttonStyle/u);
  assert.match(themeRuntime, /root\.dataset\.mediaStyle = theme\.recipe\.mediaStyle/u);
  assert.match(themeRuntime, /root\.dataset\.motionStyle = theme\.recipe\.motionStyle/u);
  assert.match(
    themeRuntime,
    /root\.dataset\.navigationStyle = theme\.recipe\.navigationStyle/u,
  );
});

test('shared theme contract is the final Storefront visual layer', () => {
  const homeFeedImport = storefrontMain.indexOf("import './home-feed.css';");
  const themeContract = storefrontMain.indexOf(
    "import '@site/storefront-ui/theme-contract.css';",
  );
  assert.equal(
    storefrontMain.includes("import './content-ui.css';"),
    false,
    'unused generic product-card CSS must stay out of the Home critical bundle',
  );
  assert.ok(
    themeContract > homeFeedImport,
    'theme contract must load after Home structural CSS',
  );
  assert.equal(
    sharedPackage.exports['./theme-contract.css'],
    './src/theme-contract.css',
    'shared package must export the theme contract',
  );
});

test('Admin Theme Center preview consumes the same shared contract', () => {
  assert.match(adminMain, /@site\/storefront-ui\/theme-contract\.css/u);
  assert.match(themeCenterView, /data-theme=\{selectedPreset\.key\}/u);
  assert.match(themeCenterView, /data-font-pack=\{recipe\.fontPack\}/u);
  assert.match(themeCenterView, /data-button-style=\{recipe\.buttonStyle\}/u);
  assert.match(themeCenterView, /data-media-style=\{recipe\.mediaStyle\}/u);
  assert.match(themeCenterView, /data-motion-style=\{recipe\.motionStyle\}/u);
  assert.match(themeCenterView, /data-navigation-style=\{recipe\.navigationStyle\}/u);
  assert.match(themeCenterView, /storefront-theme-root/u);
});

test('official theme recipes and density variants remain visually distinct', () => {
  for (const key of ['marketplace', 'noir', 'live', 'saas', 'travel', 'tech']) {
    assert.match(sharedContract, new RegExp(`data-theme='${key}'`, 'u'));
  }
  assert.match(sharedContract, /data-density='compact'/u);
  assert.match(sharedContract, /data-density='comfortable'/u);
  assert.match(sharedContract, /--theme-radius-card/u);
  assert.match(sharedContract, /--theme-control-height/u);
  assert.match(sharedContract, /--theme-card-background/u);
  assert.match(sharedContract, /--theme-header-background/u);
  assert.match(sharedContract, /--theme-tab-background/u);
  for (const recipeAttribute of [
    'data-button-style',
    'data-media-style',
    'data-motion-style',
    'data-navigation-style',
  ]) {
    assert.match(sharedContract, new RegExp(recipeAttribute, 'u'));
  }
  assert.match(sharedContract, /\.bottom-nav a::before\s*\{[\s\S]*?opacity:\s*0;/u);
  assert.match(
    sharedContract,
    /\.bottom-nav a\.is-active::before\s*\{[\s\S]*?opacity:\s*var\(--theme-nav-indicator-opacity,\s*0\);/u,
  );
});

test('official themes keep media precise while controls and icon objects stay tactile', () => {
  assert.match(sharedContract, /--theme-radius-card:\s*2px;/u);
  assert.match(sharedContract, /--theme-radius-media:\s*0px;/u);
  assert.match(sharedContract, /--theme-radius-control:\s*12px;/u);
  assert.match(sharedContract, /--theme-radius-icon:\s*16px;/u);
  assert.match(sharedContract, /--theme-radius-chip:\s*999px;/u);
  assert.match(
    sharedContract,
    /\[data-theme='noir'\][\s\S]*?--theme-radius-card:\s*0px;[\s\S]*?--theme-radius-media:\s*0px;[\s\S]*?--theme-radius-control:\s*14px;[\s\S]*?--theme-radius-icon:\s*16px;[\s\S]*?--theme-radius-chip:\s*999px;/u,
  );
});

test('business layout stays structural while Theme Center owns visual tokens', () => {
  assert.match(
    contentUi,
    /\.product-card\s*\{[\s\S]*?grid-template-columns:\s*var\(--theme-desktop-media-size,/u,
  );
  assert.match(
    contentUi,
    /\.product-card-media\s*\{[\s\S]*?border-radius:\s*var\(--theme-radius-media,/u,
  );
  assert.doesNotMatch(sharedContract, /html \.product-card\s*\{/u);
  assert.doesNotMatch(sharedContract, /grid-template-columns:\s*repeat\(3/u);
  assert.doesNotMatch(sharedContract, /grid-template-columns:\s*repeat\(4/u);
});
