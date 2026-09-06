import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('home startup keeps route-only content loaders behind lazy boundaries', () => {
  const main = source('../src/main.tsx');
  const root = source('../src/StorefrontRoot.tsx');
  const home = source('../src/HomeFeed.tsx');
  const content = source('../src/content.ts');
  const routeContent = source('../src/content-route.ts');
  const bottomNavigation = source('../src/bottom-navigation.ts');

  assert.equal(main.includes("from './content-route'"), false);
  assert.equal(main.includes("from './ArticlePage'"), false);
  assert.equal(home.includes("from './content-route'"), false);
  assert.ok(home.includes("await import('./content-route')"));
  assert.ok(root.includes("import('./ArticlePage')"));

  for (const loader of [
    'loadSectionSnapshot',
    'loadProductSnapshot',
    'loadFaqSnapshot',
    'loadArticleSnapshot',
  ]) {
    assert.equal(content.includes(`export async function ${loader}(`), false);
    assert.ok(routeContent.includes(`export async function ${loader}(`));
  }

  assert.equal(content.includes('articles.json'), false);
  assert.ok(routeContent.includes("'articles.json'"));

  for (const obsoleteRuntime of [
    'fetch(',
    'parseBottomNavigationItems',
    'loadBottomNavigation',
  ]) {
    assert.equal(bottomNavigation.includes(obsoleteRuntime), false);
  }
});
