import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const shellCss = await readFile(new URL('../src/app-shell.css', import.meta.url), 'utf8');
const browseCss = await readFile(new URL('../src/browse-ui.css', import.meta.url), 'utf8');
const browseSource = await readFile(new URL('../src/BrowsePage.tsx', import.meta.url), 'utf8');

test('mobile primary header keeps the backend brand visually centered', () => {
  assert.match(
    shellCss,
    /@media \(max-width: 767px\)[\s\S]*?\.app-shell > \.topbar \{[\s\S]*?justify-content:\s*center;/u,
  );
  assert.match(
    shellCss,
    /\.app-shell \.brand-lockup \{[\s\S]*?justify-content:\s*center;[\s\S]*?text-align:\s*center;/u,
  );
  assert.match(shellCss, /\.app-shell \.brand-logo:empty \{[\s\S]*?display:\s*none;/u);
  assert.match(
    shellCss,
    /\.app-shell \.brand-lockup small \{[\s\S]*?display:\s*none;/u,
  );
});

test('Browse section entry always has a compact visual anchor', () => {
  assert.equal(browseSource.includes('function sectionInitial(name: string)'), true);
  assert.equal(browseSource.includes('browse-section-card-media'), true);
  assert.equal(browseSource.includes("' is-fallback'"), true);
  assert.equal(browseSource.includes('presentation?.backgroundUrl'), true);

  assert.match(
    browseCss,
    /\.browse-section-card \{[\s\S]*?min-height:\s*70px;[\s\S]*?grid-template-columns:\s*48px minmax\(0, 1fr\) 28px;[\s\S]*?border-radius:/u,
  );
  assert.match(
    browseCss,
    /\.browse-section-card-media\.is-fallback \{[\s\S]*?background:\s*color-mix\(in srgb, var\(--brand\) 12%, var\(--surface-soft\)\);/u,
  );
  assert.match(
    browseCss,
    /@media \(max-width: 767px\)[\s\S]*?\.browse-section-card \{[\s\S]*?min-height:\s*68px;/u,
  );
});
