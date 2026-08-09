import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mainSource = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const shellCss = await readFile(new URL('../src/app-shell.css', import.meta.url), 'utf8');

test('storefront loads the app shell refinement layer after PWA styles', () => {
  const pwaImport = mainSource.indexOf("import './pwa.css';");
  const shellImport = mainSource.indexOf("import './app-shell.css';");
  assert.ok(pwaImport >= 0, 'PWA styles must be loaded');
  assert.ok(shellImport > pwaImport, 'app shell overrides must load after PWA styles');
});

test('mobile app shell uses dynamic viewport height and a non-floating tab bar', () => {
  assert.match(shellCss, /100dvh/u);
  assert.match(shellCss, /\.site-footer\s*\{\s*display:\s*none;/u);
  assert.match(shellCss, /\.app-shell \.bottom-nav\s*\{[\s\S]*?border-radius:\s*0;/u);
});

test('conversation route becomes focused full-screen UI without global chrome', () => {
  assert.match(shellCss, /\.app-shell:has\(\.chat-page\) > \.topbar/u);
  assert.match(shellCss, /\.app-shell:has\(\.chat-page\) > \.bottom-nav/u);
  assert.match(shellCss, /\.app-shell:has\(\.chat-page\) \.chat-page\s*\{[\s\S]*?height:\s*100dvh;/u);
  assert.match(shellCss, /\.chat-composer\s*\{[\s\S]*?safe-area-inset-bottom/u);
});
