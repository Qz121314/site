import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('product detail loading and shell behavior stay with their real style owners', () => {
  const shellUrl = new URL('../src/product-detail-shell.css', import.meta.url);
  const main = source('../src/main.tsx');
  const loadingCss = source('../src/loading-states.css');
  const appShellCss = source('../src/app-shell.css');
  const productDetailPage = source('../src/ProductDetailPage.tsx');

  assert.equal(existsSync(shellUrl), false);
  assert.equal(main.includes("import './product-detail-shell.css';"), false);

  assert.ok(main.includes("import './loading-states.css';"));
  assert.ok(loadingCss.includes('.product-detail-loading {'));
  assert.ok(loadingCss.includes('.product-detail-loading-action {'));
  assert.ok(loadingCss.includes('.product-detail-loading-inline-action {'));

  assert.ok(appShellCss.includes('.app-shell:has(.product-detail-loading)'));
  assert.match(
    appShellCss,
    /\.app-shell:has\(\.product-detail-page\)[\s\S]*?> \.topbar,[\s\S]*?\.app-shell:has\(\.product-detail-loading\)[\s\S]*?> \.topbar \{[\s\S]*?display: none;/,
  );
  assert.match(
    appShellCss,
    /\.app-shell:has\(\.product-detail-page\) > main,[\s\S]*?\.app-shell:has\(\.product-detail-loading\)[\s\S]*?> main \{[\s\S]*?min-height: 100dvh;[\s\S]*?padding-top: 0;/,
  );

  assert.ok(productDetailPage.includes("import './product-detail-ui.css';"));
  assert.equal(main.includes("import './product-detail-ui.css';"), false);
});
