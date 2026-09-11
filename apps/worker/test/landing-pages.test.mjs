import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../../../migrations/0040_landing_pages.sql', import.meta.url),
  'utf8',
);

test('landing schema is independent, product-referencing, and does not restore H5', () => {
  assert.match(migration, /CREATE TABLE landing_pages/u);
  assert.match(migration, /product_id TEXT NOT NULL REFERENCES products\(id\)/u);
  assert.match(migration, /hero_asset_id TEXT REFERENCES media_assets\(id\)/u);
  assert.match(migration, /template_key TEXT NOT NULL DEFAULT 'direct_response'/u);
  assert.match(migration, /CHECK \(status IN \('draft', 'published', 'archived'\)\)/u);
  assert.doesNotMatch(migration, /h5_pages|presentation_mode|landing_media_copy/u);
});

test('landing publication contract keeps a separate namespaced static artifact', () => {
  const source = readFileSync(
    new URL('../src/publishing/landing-publisher.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /LANDING_PUBLICATION_SCHEMA_VERSION = 1/u);
  assert.match(source, /landing-publication\/v1/u);
  assert.match(source, /validateLandingPublication/u);
  assert.match(source, /buildLandingModel/u);
  assert.doesNotMatch(source, /is_visible\s*=\s*1/u);
});

test('landing slug and template contracts are finite and normalized', () => {
  const source = readFileSync(
    new URL('../src/landing/landing-pages.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /direct_response.*visual_story.*chat_first/su);
  assert.match(source, /replace\(\/\[\^a-z0-9\]/u);
  assert.match(source, /RESERVED_SLUGS/u);
});
