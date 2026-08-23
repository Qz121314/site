import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('mobile home keeps discovery content visible and app-like in the first fold', async () => {
  const [heroStyles, homeStyles, loadingStyles, html] = await Promise.all([
    readFile(new URL('../../../packages/storefront-ui/src/home.css', import.meta.url), 'utf8'),
    readFile(new URL('../../../packages/storefront-ui/src/home.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/loading-states.css', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
  ]);

  assert.match(
    heroStyles,
    /@media \(max-width: 767px\)[\s\S]*?\.hero-carousel-slide \{[\s\S]*?height: clamp\(300px, 52svh, 440px\);[\s\S]*?min-height: 0;[\s\S]*?aspect-ratio: auto;/u,
  );
  assert.match(
    heroStyles,
    /@media \(max-width: 767px\)[\s\S]*?\.hero-carousel-overlay \{[\s\S]*?padding: 22px/u,
  );
  assert.doesNotMatch(heroStyles, /min-height: clamp\(320px, 64vh, 540px\);/u);
  assert.doesNotMatch(heroStyles, /aspect-ratio: 4 \/ 5;/u);

  assert.match(
    homeStyles,
    /@media \(max-width: 767px\)[\s\S]*?\.home-shortcuts \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);[\s\S]*?overflow: visible;/u,
  );
  assert.match(
    homeStyles,
    /@media \(max-width: 767px\)[\s\S]*?\.home-shortcut \{[\s\S]*?width: 100%;[\s\S]*?min-width: 0;/u,
  );
  assert.match(
    loadingStyles,
    /@media \(max-width: 767px\)[\s\S]*?\.startup-shortcut-skeletons \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/u,
  );
  assert.match(
    html,
    /@media \(max-width: 767px\)[\s\S]*?\.boot-shortcuts \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/u,
  );
});
