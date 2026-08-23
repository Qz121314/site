import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('home startup keeps route-only content loaders behind lazy boundaries', () => {
  const main = source('../src/main.tsx');
  const home = source('../src/HomeFeed.tsx');
  const content = source('../src/content.ts');
  const routeContent = source('../src/content-route.ts');
  const bottomNavigation = source('../src/bottom-navigation.ts');

  assert.equal(main.includes("from './content-route'"), false);
  assert.equal(
    home.includes('loadSectionSnapshot,\n} from \'./content\''),
    false,
  );
  assert.ok(home.includes("await import('./content-route')"));

  assert.equal(
    content.includes('export async function loadSectionSnapshot('),
    false,
  );
  assert.equal(
    content.includes('export async function loadProductSnapshot('),
    false,
  );
  assert.equal(content.includes('export async function loadFaqSnapshot('), false);
  assert.ok(routeContent.includes('export async function loadSectionSnapshot('));
  assert.ok(routeContent.includes('export async function loadProductSnapshot('));
  assert.ok(routeContent.includes('export async function loadFaqSnapshot('));

  assert.equal(bottomNavigation.includes('fetch('), false);
  assert.equal(bottomNavigation.includes('parseBottomNavigationItems'), false);
  assert.equal(bottomNavigation.includes('loadBottomNavigation'), false);
});
