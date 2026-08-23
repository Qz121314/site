import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

// Theme editing and mobile preview belong to one compact viewport workbench instead of a tall inline side panel.
test('theme center combines settings and mobile preview inside one compact modal workbench', () => {
  const view = source('../src/ThemeCenterView.tsx');
  const baseCss = source('../src/theme-center.css');
  const workbenchCss = source('../src/theme-center-workbench.css');

  assert.ok(view.includes("import { createPortal } from 'react-dom';"));
  assert.ok(view.includes("import './theme-center-workbench.css';"));
  assert.ok(view.includes('const [previewOpen, setPreviewOpen] = useState(false);'));
  assert.ok(view.includes('主题设置与预览'));
  assert.ok(view.includes('className="theme-center-layout theme-center-layout-single"'));
  assert.equal(view.includes('<aside className="theme-preview-panel">'), false);
  assert.ok(view.includes('className="theme-preview-modal theme-workbench-modal"'));
  assert.ok(view.includes('className="theme-settings-pane"'));
  assert.ok(view.includes('className="theme-preview-stage"'));
  assert.ok(view.includes('theme-modal-save-button'));
  assert.ok(view.includes('StorefrontHero'));
  assert.ok(view.includes('StorefrontHomeShortcut'));
  assert.ok(view.includes('StorefrontHomeProductTile'));
  assert.ok(view.includes('StorefrontProductCard'));
  assert.ok(view.includes('className="home-feed has-hero"'));
  assert.ok(view.includes('className="home-shortcuts"'));
  assert.ok(view.includes('className="home-product-rail theme-preview-products"'));
  assert.ok(
    view.includes(
      "type ThemePreviewPage = 'home' | 'catalog' | 'detail' | 'messages' | 'install';",
    ),
  );
  assert.ok(
    view.includes(
      "const [previewPage, setPreviewPage] = useState<ThemePreviewPage>('home');",
    ),
  );
  assert.ok(view.includes('className="theme-preview-page-switcher"'));
  assert.ok(view.includes('aria-pressed={previewPage === page.key}'));
  assert.ok(view.includes('page={previewPage}'));
  assert.ok(view.includes('className="theme-preview-catalog"'));
  assert.ok(
    view.includes('className="product-detail-summary theme-preview-detail-summary"'),
  );
  assert.ok(view.includes('className="chat-page theme-preview-chat"'));
  assert.ok(view.includes('className="pwa-install-card theme-preview-install-card"'));
  assert.ok(view.includes('installPrompt.enabled ?'));
  assert.ok(view.includes('className="theme-preview-install-disabled"'));
  assert.ok(view.includes('className="theme-contrast-status"'));
  assert.ok(view.includes('aria-modal="true"'));
  assert.ok(view.includes("event.key === 'Escape'"));
  assert.ok(view.includes('onMouseDown={(event) => event.stopPropagation()}'));
  assert.equal(view.match(/className="theme-preview-device-shell"/g)?.length, 1);
  assert.ok(
    view.indexOf('className="theme-settings-pane"') >
      view.indexOf('className="theme-preview-modal-backdrop"'),
  );
  assert.ok(
    view.indexOf('<MobileThemePreview') >
      view.indexOf('className="theme-preview-modal-backdrop"'),
  );
  assert.match(baseCss, /\.theme-preview-modal-backdrop\s*\{[^}]*position: fixed;/s);
  assert.ok(baseCss.includes('max-height: calc(100dvh - 32px);'));

  // The workbench stays materially smaller than the viewport on desktop and outranks generic preview rules.
  assert.match(
    workbenchCss,
    /\.theme-preview-modal\.theme-workbench-modal\s*\{[^}]*width:\s*min\(980px, calc\(100vw - 48px\)\);[^}]*height:\s*min\(720px, calc\(100dvh - 48px\)\);/s,
  );
  assert.match(
    workbenchCss,
    /\.theme-preview-modal-header\s*>\s*\.theme-preview-modal-actions\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*nowrap;/s,
  );
  assert.match(
    workbenchCss,
    /\.theme-preview-modal-body\.theme-workbench-modal-body\s*\{[^}]*grid-template-columns:\s*minmax\(380px, 1\.06fr\) minmax\(300px, 0\.94fr\);[^}]*overflow:\s*hidden;/s,
  );
  assert.match(workbenchCss, /\.theme-settings-pane\s*\{[^}]*overflow: auto;/s);
  assert.ok(workbenchCss.includes('width: min(100%, 270px);'));
  assert.ok(workbenchCss.includes('height: 500px;'));
  assert.ok(workbenchCss.includes('scrollbar-gutter: stable;'));
  assert.ok(workbenchCss.includes('@media (max-width: 760px)'));
  assert.ok(workbenchCss.includes('grid-template-columns: minmax(0, 1fr);'));
  assert.ok(workbenchCss.includes('overscroll-behavior: contain;'));
  assert.match(baseCss, /\.theme-preview-page-switcher\s*\{[^}]*display: grid;/s);
  assert.match(baseCss, /\.theme-preview-catalog\s*\{[^}]*display: grid;/s);
  assert.match(baseCss, /\.theme-preview-detail-summary\s*\{[^}]*display: grid;/s);
  assert.match(baseCss, /\.theme-preview-chat\s*\{[^}]*display: grid;/s);
  assert.match(baseCss, /\.theme-preview-install-card\s*\{[^}]*display: grid;/s);
});
