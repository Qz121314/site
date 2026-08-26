import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('theme center preview reuses live storefront components instead of swatch-only mocks', () => {
  const view = source('../src/ThemeCenterView.tsx');
  const preview = source('../src/ThemeCenterPreview.tsx');
  const diagnostics = source('../src/theme-center/diagnostics.ts');

  assert.ok(view.includes("import { ThemeCenterPreview } from './ThemeCenterPreview';"));
  assert.ok(view.includes('accent={previewAccent}'));
  assert.ok(view.includes('textColor={previewTextColor}'));
  assert.ok(preview.includes('StorefrontBrandBar'));
  assert.ok(preview.includes('StorefrontHero'));
  assert.ok(preview.includes('StorefrontHomeShortcut'));
  assert.ok(preview.includes('StorefrontHomeProductTile'));
  assert.ok(preview.includes('StorefrontBottomNavigation'));
  assert.ok(preview.includes('storefrontThemeStyle'));

  for (const diagnostic of [
    "id: 'text'",
    "id: 'cta'",
    "id: 'surface'",
    "id: 'darkness'",
    "id: 'border'",
  ]) {
    assert.ok(diagnostics.includes(diagnostic));
  }
  assert.ok(diagnostics.includes('storefrontContrastRatio'));
  assert.ok(diagnostics.includes('storefrontRelativeLuminance'));
});
