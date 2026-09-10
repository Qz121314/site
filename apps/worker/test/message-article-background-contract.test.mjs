import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

test('Message CTA backgrounds are weak media references on the generic card table', () => {
  const migration = read('../../../migrations/0035_message_cta_cards.sql');
  const route = read('../src/routes/admin-message-articles.ts');
  const publisher = read('../src/publishing/modular-publisher.ts');
  assert.match(migration, /background_media_id TEXT(?: NULL)? REFERENCES/u);
  assert.match(migration, /REFERENCES media_assets\(id\) ON DELETE SET NULL/u);
  assert.match(route, /message_cta_cards/u);
  assert.match(route, /status = 'ready'/u);
  assert.match(route, /mime_type LIKE 'image\/%'/u);
  assert.match(publisher, /backgroundObjectKey: article\.background_object_key/u);
  assert.doesNotMatch(route, /message_article_references/u);
  assert.doesNotMatch(route, /articleIds/u);
});

test('publication resolves public object keys without adding a media request path', () => {
  const bootstrap = read('../src/publishing/storefront-bootstrap-snapshot.ts');
  const storefront = read('../../storefront/src/messages-articles.ts');
  assert.match(bootstrap, /backgroundObjectKey/u);
  assert.doesNotMatch(bootstrap, /media_assets|D1Database/u);
  assert.match(storefront, /backgroundObjectKey/u);
  assert.doesNotMatch(storefront, /\bfetch\s*\(|\/api\/[^'"`]*media/iu);
});
