import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('Theme Studio keeps draft-only selection and the existing safe persistence boundary', () => {
  const view = source('../src/ThemeCenterView.tsx');

  assert.ok(view.includes('主题库'));
  assert.ok(view.includes('品牌强调色'));
  assert.ok(view.includes('主文字颜色'));
  assert.ok(view.includes('保存主题'));
  assert.ok(view.includes('恢复修改'));
  assert.ok(view.includes('useAdminDirtySource'));
  assert.ok(view.includes('themeDiagnostics'));
  assert.equal(view.includes('createPortal'), false);
  assert.ok(view.includes('importThemeFromRegistry'));
  assert.ok(view.includes('importThemeFromJson'));
});

test('PWA install prompt is owned by Site Settings', () => {
  const workspace = source('../src/settings/SiteSettingsWorkspace.tsx');
  const view = source('../src/experience/PwaSettingsView.tsx');

  assert.ok(workspace.includes("view === 'pwa'"));
  assert.ok(workspace.includes('<PwaSettingsView'));
  assert.ok(view.includes('installPrompt'));
  assert.ok(view.includes('delaySeconds'));
  assert.ok(view.includes('iosDescription'));
  assert.ok(view.includes("useAdminDirtySource('pwa-settings'"));
});
