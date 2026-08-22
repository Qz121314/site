import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

// Theme editing and mobile preview belong to one viewport workbench instead of a tall inline side panel.
test('theme center combines settings and mobile preview inside one modal workbench', () => {
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
  assert.ok(workbenchCss.includes('width: min(100%, 1120px);'));
  assert.match(
    workbenchCss,
    /\.theme-workbench-modal-body\s*\{[^}]*grid-template-columns:\s*minmax\(360px, 440px\) minmax\(360px, 1fr\);/s,
  );
  assert.match(workbenchCss, /\.theme-settings-pane\s*\{[^}]*overflow: auto;/s);
  assert.ok(workbenchCss.includes('overscroll-behavior: contain;'));
});
