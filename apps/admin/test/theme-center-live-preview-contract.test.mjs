import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('Theme Studio preview reuses live storefront home components without restoring Hero semantics', () => {
  const view = source('../src/ThemeCenterView.tsx');
  const preview = source('../src/ThemeCenterPreview.tsx');
  const diagnostics = source('../src/theme-center/diagnostics.ts');

  assert.ok(view.includes("import { ThemeCenterPreview } from './ThemeCenterPreview';"));
  assert.ok(view.includes('主题库'));
  assert.ok(view.includes('样式设置'));
  assert.ok(view.includes('viewport={viewport}'));
  assert.ok(preview.includes('StorefrontBrandBar'));
  assert.ok(preview.includes('StorefrontHomeShortcut'));
  assert.ok(preview.includes('StorefrontHomeProductTile'));
  assert.ok(preview.includes('StorefrontBottomNavigation'));
  assert.ok(preview.includes('storefrontThemeStyle'));
  assert.equal(preview.includes('StorefrontHero'), false);

  for (const diagnostic of ["id: 'text'", "id: 'cta'", "id: 'surface'", "id: 'border'"]) {
    assert.ok(diagnostics.includes(diagnostic));
  }
  assert.ok(diagnostics.includes('storefrontContrastRatio'));
  assert.ok(diagnostics.includes('storefrontRelativeLuminance'));
});
