import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

test('background media schema belongs only to Messages placement', () => {
  const migration = read('../../../migrations/0032_message_article_background_media.sql');
  const publisher = read('../src/publishing/modular-publisher.ts');
  const articleModel = publisher.slice(
    publisher.indexOf('function articleModel'),
    publisher.indexOf('function faqModel'),
  );

  assert.match(migration, /ALTER TABLE message_article_references/u);
  assert.match(migration, /background_media_id TEXT NULL/u);
  assert.match(migration, /REFERENCES media_assets\(id\) ON DELETE SET NULL/u);
  assert.doesNotMatch(migration, /ALTER TABLE faqs/u);
  assert.doesNotMatch(articleModel, /background|placement|messageArticle/iu);
});

test('Admin placement API validates ready image media and keeps ordered replacement', () => {
  const source = read('../src/routes/admin-message-articles.ts');

  assert.match(source, /backgroundMediaId/u);
  assert.match(source, /status = 'ready'/u);
  assert.match(source, /deleted_at IS NULL/u);
  assert.match(source, /mime_type LIKE 'image\/%'/u);
  assert.match(source, /DELETE FROM message_article_references/u);
  assert.match(source, /background_media_id/u);
  assert.match(source, /LEFT JOIN media_assets background/u);
  assert.match(source, /background.status = 'ready'/u);
  assert.match(source, /background.deleted_at IS NULL/u);
  assert.match(source, /'isEnabled' in value/u);
  assert.doesNotMatch(source, /isEnabled:\s*boolean/u);
  assert.doesNotMatch(source, /isEnabled:\s*row\.is_enabled/u);
  assert.doesNotMatch(source, /placement\.isEnabled/u);
  assert.match(source, /VALUES \(\?, \?, \?, 1, \?, \?\)/u);
  assert.doesNotMatch(source, /INSERT INTO faqs[\s\S]*background/iu);
});

test('publication resolves public object keys without failing missing media', () => {
  const source = read('../src/publishing/modular-publisher.ts');

  assert.match(source, /LEFT JOIN media_assets background/u);
  assert.match(source, /background\.object_key AS background_object_key/u);
  assert.match(source, /backgroundObjectKey: article\.background_object_key/u);
  assert.match(
    source,
    /source\.messageArticles\.map\(\(article\) => article\.background_object_key\)/u,
  );
});

test('media lifecycle treats placement backgrounds as in-use without cascade deletion', () => {
  const managedDelete = read('../src/media/media-delete.ts');
  const cleanup = read('../src/assets/asset-library.ts');

  for (const source of [managedDelete, cleanup]) {
    assert.match(source, /message_article_references/u);
    assert.match(source, /background_media_id/u);
  }
  assert.match(managedDelete, /message_article_background_count/u);
  assert.match(cleanup, /message_article_background_count/u);
  assert.match(cleanup, /countReferences\(toReferenceCounts\(row\)\)/u);
  assert.doesNotMatch(cleanup, /return \(\s*countRowReferences\(row\)/u);
});

test('bootstrap and Storefront metadata plumbing adds no media API or D1 lookup', () => {
  const bootstrap = read('../src/publishing/storefront-bootstrap-snapshot.ts');
  const storefront = read('../../storefront/src/messages-articles.ts');

  assert.match(bootstrap, /backgroundObjectKey/u);
  assert.doesNotMatch(bootstrap, /media_assets|D1Database/u);
  assert.match(storefront, /backgroundObjectKey/u);
  assert.doesNotMatch(storefront, /\bfetch\s*\(|\/api\/[^'"`]*media/iu);
});
