import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mainSource = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const detailSource = await readFile(
  new URL('../src/ProductDetailPage.tsx', import.meta.url),
  'utf8',
);
const rootSource = await readFile(
  new URL('../src/StorefrontRoot.tsx', import.meta.url),
  'utf8',
);
const detailCss = await readFile(
  new URL('../src/product-detail-ui.css', import.meta.url),
  'utf8',
);
const detailThemeCss = await readFile(
  new URL(
    '../../../packages/storefront-ui/src/product-detail-theme-contract.css',
    import.meta.url,
  ),
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

test('product detail structure loads before Theme Center visual recipes', () => {
  const detailUi = mainSource.indexOf("import './product-detail-ui.css';");
  const sharedTheme = mainSource.indexOf(
    "import '@site/storefront-ui/theme-contract.css';",
  );
  const detailTheme = mainSource.indexOf(
    "import '@site/storefront-ui/product-detail-theme-contract.css';",
  );
  assert.ok(detailUi >= 0, 'product detail structural styles must load');
  assert.ok(
    sharedTheme > detailUi,
    'shared Theme Center contract must load after detail structure',
  );
  assert.ok(
    detailTheme > sharedTheme,
    'detail Theme Center extension must be the final detail visual layer',
  );
});

test('product detail routes through the primary Storefront shell', () => {
  assert.match(rootSource, /case 'product':/u);
  assert.match(rootSource, /productRef=\{route\.productRef\}/u);
  assert.match(rootSource, /sectionRef=\{route\.sectionRef\}/u);
  assert.match(rootSource, /<ProductDetailPage/u);
  assert.match(rootSource, /<PrimaryShell[\s\S]*activePath=\{pathname\}/u);
});

test('product detail keeps a focused media and information hierarchy', () => {
  assert.match(detailSource, /className="detail-gallery"/u);
  assert.match(detailSource, /className="product-detail-info"/u);
  assert.match(detailSource, /className="product-detail-summary"/u);
  assert.match(detailSource, /<h1 id="product-detail-title">\{product\.title\}<\/h1>/u);
  assert.match(detailSource, /className="product-detail-category"/u);
  assert.match(detailSource, /className="product-detail-tags"/u);
  assert.match(detailSource, /className="product-detail-body"/u);
  assert.match(detailSource, /<MarkdownContent source=\{product\.body\} \/>/u);
  assert.match(
    detailSource,
    /className="product-detail-info"[\s\S]*?className="product-detail-summary"[\s\S]*?className="product-detail-body"/u,
  );
  assert.doesNotMatch(detailSource, /recommend|rating|favorite|share/iu);
});

test('product gallery keeps thumbnails directly below the active media stage', () => {
  assert.match(detailSource, /className="detail-media-stage"/u);
  assert.match(detailSource, /className="detail-media-thumbnails"/u);
  assert.match(detailSource, /setActiveMediaId\(item\.id\)/u);
  assert.match(detailSource, /aria-pressed=\{selected\}/u);
  assert.match(
    detailCss,
    /\.detail-gallery\s*\{[\s\S]*?display:\s*flex[\s\S]*?flex-direction:\s*column/u,
  );
  assert.match(
    detailCss,
    /\.detail-media-stage\s*\{[\s\S]*?width:\s*100%[\s\S]*?max-width:\s*100%/u,
  );
  assert.match(
    detailCss,
    /\.detail-media-thumbnails\s*\{[\s\S]*?width:\s*100%[\s\S]*?overflow-x:\s*auto[\s\S]*?overflow-y:\s*hidden/u,
  );
  assert.match(
    detailCss,
    /\.detail-media-stage > img,[\s\S]*?\.detail-media-stage > video/u,
  );
  assert.doesNotMatch(detailCss, /scroll-snap-type:\s*x mandatory/u);
  assert.match(detailSource, /<ResilientVideo/u);
  assert.match(detailSource, /<ResilientImage/u);
});

test('product detail main media stays square and shows the full source image', () => {
  assert.match(detailThemeCss, /--theme-detail-media-ratio:\s*1 \/ 1/u);
  assert.match(detailThemeCss, /--theme-detail-desktop-media-ratio:\s*1 \/ 1/u);
  assert.match(
    detailThemeCss,
    /\.detail-media-stage > img\s*\{[\s\S]*?object-fit:\s*contain/u,
  );
  assert.doesNotMatch(
    detailThemeCss,
    /--theme-detail-(?:desktop-)?media-ratio:\s*(?:4 \/ 3|16 \/ 10)/u,
  );
});

test('product CTA mounts at the viewport layer and keeps safe-area spacing', () => {
  assert.match(detailSource, /import \{ createPortal \} from 'react-dom'/u);
  assert.match(detailSource, /createPortal\(ctaAction, document\.body\)/u);
  assert.match(
    detailCss,
    /\.product-detail-fixed-action\s*\{[\s\S]*?position:\s*fixed[\s\S]*?bottom:\s*0/u,
  );
  assert.match(
    detailCss,
    /\.product-detail-fixed-action\s*\{[\s\S]*?padding:[^;]*env\(safe-area-inset-bottom\)/u,
  );
  assert.match(
    detailCss,
    /\.product-detail-page\s*\{[\s\S]*?padding-bottom:\s*calc\(82px \+ env\(safe-area-inset-bottom\)\)/u,
  );
  assert.doesNotMatch(
    detailCss,
    /\.product-detail-page:has\(\.product-detail-fixed-action\)/u,
  );
  assert.doesNotMatch(
    detailCss,
    /bottom:\s*calc\(67px \+ env\(safe-area-inset-bottom\)\)/u,
  );
});

test('desktop uses a compact capped two-column layout only at true desktop width', () => {
  assert.match(detailCss, /@media \(min-width:\s*768px\) and \(max-width:\s*979px\)/u);
  assert.doesNotMatch(detailCss, /@media \(min-width:\s*768px\)\s*\{/u);
  assert.match(
    detailCss,
    /@media \(min-width:\s*980px\)[\s\S]*?\.product-detail-page\s*\{[\s\S]*?width:\s*min\(920px, 100%\)/u,
  );
  assert.match(
    detailCss,
    /@media \(min-width:\s*980px\)[\s\S]*?\.product-detail-hero\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 520px\) minmax\(280px, 340px\)/u,
  );
  assert.match(
    detailCss,
    /@media \(min-width:\s*980px\)[\s\S]*?\.detail-gallery\s*\{[\s\S]*?max-width:\s*520px/u,
  );
  assert.match(
    detailCss,
    /@media \(min-width:\s*980px\)[\s\S]*?\.product-detail-fixed-action \.cta-button\s*\{[\s\S]*?width:\s*min\(520px, 100%\)/u,
  );
});

test('Theme Center owns product detail visual treatment for every official theme', () => {
  for (const key of ['marketplace', 'noir', 'live', 'saas', 'travel', 'tech']) {
    assert.match(detailThemeCss, new RegExp(`data-theme='${key}'`, 'u'));
  }
  assert.match(detailThemeCss, /data-density='compact'/u);
  assert.match(detailThemeCss, /data-density='comfortable'/u);
  assert.match(detailThemeCss, /--theme-detail-panel-background/u);
  assert.match(detailThemeCss, /--theme-detail-media-radius/u);
  assert.match(detailThemeCss, /--theme-detail-cta-surface/u);
  assert.match(detailThemeCss, /\.product-detail-summary/u);
  assert.match(detailThemeCss, /\.product-detail-body/u);
  assert.match(detailThemeCss, /\.product-detail-fixed-action/u);
  assert.doesNotMatch(detailThemeCss, /\.product-detail-mobile-action/u);
});

test('shared package and Admin preview load the product detail Theme Center extension', () => {
  assert.equal(
    sharedPackage.exports['./product-detail-theme-contract.css'],
    './src/product-detail-theme-contract.css',
  );
  assert.match(adminMain, /@site\/storefront-ui\/product-detail-theme-contract\.css/u);
});

test('product detail keeps published CTA label authoritative and resolves destination on demand', () => {
  assert.match(detailSource, /product\.cta\?\.label/u);
  assert.match(detailSource, /SYSTEM_UI\.continue/u);
  assert.match(
    detailSource,
    /\/api\/public\/storefront\/cta\/\$\{encodeURIComponent\(productId\)\}\/resolve/u,
  );
  assert.match(detailSource, /method: 'POST'/u);
  assert.match(detailSource, /SYSTEM_UI\.temporarilyUnavailable/u);
  assert.match(detailSource, /ctaResolveState === 'unavailable'/u);
  assert.doesNotMatch(detailSource, /\{product\.cta \? \(/u);
  assert.doesNotMatch(detailSource, /href=\{product\.cta\.path\}/u);
});
