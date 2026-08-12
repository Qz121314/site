import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const view = await readFile(
  new URL('../src/ThemeCenterView.tsx', import.meta.url),
  'utf8',
);
const api = await readFile(
  new URL('../src/theme-center/api.ts', import.meta.url),
  'utf8',
);
const css = await readFile(new URL('../src/theme-center.css', import.meta.url), 'utf8');

test('Theme Center exposes limited recipe selections instead of arbitrary CSS', () => {
  for (const label of [
    '字体方案',
    '页面密度',
    '按钮方案',
    '素材方案',
    '点击与转场',
    '导航风格',
  ]) {
    assert.match(view, new RegExp(label, 'u'));
  }
  assert.match(view, /恢复模板/u);
  assert.doesNotMatch(view, /customCss|cssEditor|styleText/u);
  assert.match(css, /\.theme-recipe-editor/u);
  assert.match(css, /\.theme-recipe-grid/u);
});

test('Theme Center persists the complete recipe through the existing update API', () => {
  assert.match(api, /recipe:\s*Omit<ThemeRecipe, 'version'>/u);
  for (const key of [
    'density',
    'fontPack',
    'buttonStyle',
    'mediaStyle',
    'motionStyle',
    'navigationStyle',
  ]) {
    assert.match(api, new RegExp(`${key}: recipe\\.${key}`, 'u'));
  }
});
