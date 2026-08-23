import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('theme center keeps theme choice and brand accent without a duplicate preview workbench', () => {
  const view = source('../src/ThemeCenterView.tsx');

  assert.ok(view.includes('官方精选'));
  assert.ok(view.includes('品牌强调色'));
  assert.ok(view.includes('保存并应用'));
  assert.ok(view.includes('打开用户前端'));
  assert.ok(view.includes('恢复主题色'));
  assert.ok(view.includes('整套视觉方案'));
  assert.equal(view.includes('ThemePreview'), false);
  assert.equal(view.includes('createPortal'), false);
  assert.equal(view.includes('UI Recipe'), false);
  assert.equal(view.includes('安装应用提示'), false);
  assert.equal(view.includes('theme-center-workbench.css'), false);
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
