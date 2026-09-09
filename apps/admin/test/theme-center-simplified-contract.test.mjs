import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('Theme Studio keeps draft-only selection and the existing safe persistence boundary', () => {
  const view = source('../src/ThemeCenterView.tsx');

  assert.ok(view.includes('主题方案库'));
  assert.ok(view.includes('品牌强调色'));
  assert.ok(view.includes('主文字颜色'));
  assert.ok(view.includes('保存并应用'));
  assert.ok(view.includes('打开用户前端'));
  assert.ok(view.includes('恢复当前设置'));
  assert.ok(view.includes('useAdminDirtySource'));
  assert.ok(view.includes('themeDiagnostics'));
  assert.equal(view.includes('createPortal'), false);
  assert.ok(view.includes('importThemeFromRegistry'));
  assert.ok(view.includes('importThemeFromJson'));
});

test('PWA install prompt is owned by Site Settings', () => {
  const view = source('../src/SiteSettingsView.tsx');

  assert.ok(
    view.includes("type SettingsPanel = 'general' | 'home' | 'pwa' | 'advanced';"),
  );
  assert.ok(view.includes("{ id: 'pwa', label: 'PWA 安装' }"));
  assert.ok(view.includes('安装应用提示'));
  assert.ok(view.includes('延迟显示（秒）'));
  assert.ok(view.includes('iPhone / iPad 说明'));
});
