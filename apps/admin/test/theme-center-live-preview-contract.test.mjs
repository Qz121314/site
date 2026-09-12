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
  const styles = source('../src/theme-center.css');
  const previewStyles = source('../src/theme-center-preview.css');

  assert.ok(view.includes("import { ThemeCenterPreview } from './ThemeCenterPreview';"));
  assert.ok(view.includes('主题库'));
  assert.ok(view.includes('样式设置'));
  assert.ok(view.includes('viewport={viewport}'));
  assert.ok(view.includes('theme-global-actions'));
  assert.ok(view.includes('PC 模板'));
  assert.ok(view.includes('手机模板'));
  assert.ok(view.includes('自定义预览尺寸'));
  assert.ok(view.includes('theme-pane-edge-toggle'));
  assert.ok(view.includes('aria-expanded={!libraryCollapsed}'));
  assert.ok(view.includes('aria-expanded={!inspectorCollapsed}'));
  assert.ok(view.includes('收起主题库'));
  assert.ok(view.includes('展开样式设置'));
  assert.ok(preview.includes('theme-preview-frame'));
  assert.ok(preview.includes('theme-preview-scale-box'));
  assert.ok(preview.includes('ResizeObserver'));
  assert.equal(view.includes('theme-command-bar'), false);
  assert.ok(view.includes('theme-library-toolbar'));
  assert.ok(view.includes('theme-preview-toolbar'));
  assert.ok(styles.includes('.theme-global-actions'));
  assert.ok(styles.includes('.theme-pane-edge-toggle'));
  assert.ok(styles.includes('.theme-pane-edge-toggle:focus-visible'));
  assert.ok(styles.includes('.is-library-collapsed'));
  assert.ok(styles.includes('.is-inspector-collapsed'));
  assert.equal(styles.includes('.theme-inspector-actions'), false);
  assert.equal(styles.includes('.theme-action-bar'), false);
  assert.equal(styles.includes('100dvh -'), false);
  assert.ok(previewStyles.includes('overflow: hidden'));
  assert.equal(previewStyles.includes('overflow: auto'), false);
  assert.ok(preview.includes('StorefrontBrandBar'));
  assert.ok(preview.includes('StorefrontHomeShortcut'));
  assert.ok(preview.includes('home-primary-directory'));
  assert.ok(preview.includes('home-primary-directory-categories'));
  assert.ok(preview.includes('home-primary-directory-link'));
  assert.ok(preview.includes('StorefrontBottomNavigation'));
  assert.ok(preview.includes('storefrontThemeStyle'));
  assert.equal(preview.includes('StorefrontHero'), false);

  for (const diagnostic of ["id: 'text'", "id: 'cta'", "id: 'surface'", "id: 'border'"]) {
    assert.ok(diagnostics.includes(diagnostic));
  }
  assert.ok(diagnostics.includes('storefrontContrastRatio'));
  assert.ok(diagnostics.includes('storefrontRelativeLuminance'));
});
