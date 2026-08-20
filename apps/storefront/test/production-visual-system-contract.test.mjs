import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('production acceptance guards the Visual V2 system instead of stale page pixels', async () => {
  const [acceptance, home, browse, section] = await Promise.all([
    readFile(
      new URL('../../../tests/e2e/production-smoke.spec.ts', import.meta.url),
      'utf8',
    ),
    readFile(new URL('../src/home-feed.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/browse-ui.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/section-ui.css', import.meta.url), 'utf8'),
  ]);

  assert.match(acceptance, /one coherent mobile visual system across discovery routes/u);
  assert.match(acceptance, /cardRatio \?\? 0\)\.toBeCloseTo\(10 \/ 16, 1\)/u);
  assert.match(
    acceptance,
    /sectionVisualContract\.searchHeight - browseVisualContract\.searchHeight/u,
  );
  assert.match(
    acceptance,
    /sectionVisualContract\.productCoverRadius[\s\S]*homeVisualContract\.productCoverRadius/u,
  );
  assert.doesNotMatch(acceptance, /\.toBe\('16px'\)/u);
  assert.doesNotMatch(acceptance, /cardRadius: '14px'/u);
  assert.doesNotMatch(acceptance, /searchRadius: '14px'/u);

  assert.match(home, /\.home-product-rail \{[\s\S]*grid-template-columns: repeat\(2,/u);
  assert.match(home, /\.home-product-cover,[\s\S]*aspect-ratio: 1 \/ 1;/u);
  assert.match(browse, /\.browse-section-card \{[\s\S]*aspect-ratio: 16 \/ 10;/u);
  assert.match(browse, /\.browse-directory-search \{[\s\S]*box-shadow: none;/u);
  assert.match(section, /\.section-catalog-search \{[\s\S]*box-shadow: none;/u);
  assert.match(section, /\.section-product-cover \{[\s\S]*aspect-ratio: 1 \/ 1;/u);
});
