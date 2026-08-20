import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('storefront keeps backend-driven edge content inside one app layout contract', () => {
  const main = source('../src/main.tsx');
  const css = source('../src/storefront-edge-layout.css');

  assert.ok(main.includes("import './storefront-edge-layout.css';"));
  assert.ok(css.includes('body {\n  overflow-x: clip;'));
  assert.match(
    css,
    /\.hero-carousel-copy :is\(h1, h2\) \{[\s\S]*?overflow-wrap: anywhere;[\s\S]*?-webkit-line-clamp: 3;/,
  );
  assert.match(
    css,
    /\.bottom-nav small \{[\s\S]*?text-overflow: ellipsis;[\s\S]*?white-space: nowrap;/,
  );
  assert.ok(css.includes('.markdown-content pre {'));
  assert.ok(css.includes('overscroll-behavior-inline: contain;'));
  assert.ok(css.includes('.detail-mobile-media-stage > .detail-media-fallback'));
  assert.ok(css.includes('aspect-ratio: var(--theme-detail-media-ratio, 1 / 1);'));
  assert.match(
    css,
    /\.pwa-install-copy span \{[\s\S]*?-webkit-line-clamp: 2;/,
  );
  assert.ok(css.includes('right: max(10px, env(safe-area-inset-right));'));
  assert.ok(css.includes('left: max(10px, env(safe-area-inset-left));'));
});
