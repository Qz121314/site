import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('StorefrontRoot consumes bottom navigation from bootstrap without a second query', () => {
  const root = source('../src/StorefrontRoot.tsx');
  const content = source('../src/content.ts');

  assert.equal(root.includes("queryKey: ['bottom-navigation']"), false);
  assert.equal(root.includes('loadBottomNavigation(signal)'), false);
  assert.ok(root.includes('const navigationItems = bootstrap.bottomNavigation'));
  assert.ok(content.includes('bottomNavigation: BottomNavigationItemConfig[]'));
  assert.ok(
    content.includes('bottomNavigation = parseBottomNavigationItems(value.bottomNavigation)'),
  );
});
