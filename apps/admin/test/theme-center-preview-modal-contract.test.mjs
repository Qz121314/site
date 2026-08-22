import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('theme center mobile preview is a viewport modal instead of an inline device', () => {
  const view = source('../src/ThemeCenterView.tsx');
  const css = source('../src/theme-center.css');

  assert.ok(view.includes("import { createPortal } from 'react-dom';"));
  assert.ok(view.includes('const [previewOpen, setPreviewOpen] = useState(false);'));
  assert.ok(view.includes('className="secondary-button theme-preview-button"'));
  assert.ok(view.includes('aria-modal="true"'));
  assert.ok(view.includes("event.key === 'Escape'"));
  assert.ok(view.includes('onMouseDown={(event) => event.stopPropagation()}'));
  assert.equal(view.match(/className="theme-preview-device-shell"/g)?.length, 1);
  assert.ok(
    view.indexOf('className="theme-preview-device-shell"') >
      view.indexOf('className="theme-preview-modal-backdrop"'),
  );
  assert.match(css, /\.theme-preview-modal-backdrop\s*\{[^}]*position: fixed;/s);
  assert.ok(css.includes('max-height: calc(100dvh - 32px);'));
  assert.ok(css.includes('overscroll-behavior: contain;'));
});
