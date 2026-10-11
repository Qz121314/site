import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import {
  countMediaAssetReferences,
  mediaAssetReferenceCountColumnsSql,
  mediaAssetReferenceCountJoinsSql,
  mediaAssetReferenceCountsSql,
  mediaAssetUnreferencedSql,
} from '../src/media/media-asset-references.ts';

test('media deletion guards count every current D1 reference', () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE media_assets (id TEXT PRIMARY KEY, deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE site_settings (logo_asset_id TEXT, pwa_icon_asset_id TEXT);
    CREATE TABLE site_hero_slides (media_asset_id TEXT);
    CREATE TABLE site_bottom_navigation (icon_asset_id TEXT);
    CREATE TABLE sections (icon_asset_id TEXT, browse_background_asset_id TEXT);
    CREATE TABLE message_article_references (background_media_id TEXT);
    CREATE TABLE message_cta_cards (background_media_id TEXT);
    CREATE TABLE products (cover_asset_id TEXT);
    CREATE TABLE product_media (media_asset_id TEXT);
    INSERT INTO media_assets VALUES ('asset-1', 0);
    INSERT INTO site_settings VALUES ('asset-1', 'asset-1');
    INSERT INTO site_hero_slides VALUES ('asset-1');
    INSERT INTO site_bottom_navigation VALUES ('asset-1');
    INSERT INTO sections VALUES ('asset-1', 'asset-1');
    INSERT INTO message_article_references VALUES ('asset-1');
    INSERT INTO message_cta_cards VALUES ('asset-1');
    INSERT INTO products VALUES ('asset-1');
    INSERT INTO product_media VALUES ('asset-1');
  `);

  const counts = sqlite
    .prepare(
      `SELECT ${mediaAssetReferenceCountsSql('ma')}
       FROM media_assets ma WHERE ma.id = ?`,
    )
    .get('asset-1');
  assert.equal(countMediaAssetReferences(counts), 10);

  const aggregatedCounts = sqlite
    .prepare(
      `SELECT ${mediaAssetReferenceCountColumnsSql()}
       FROM media_assets ma
       ${mediaAssetReferenceCountJoinsSql('ma')}
       WHERE ma.id = ?`,
    )
    .get('asset-1');
  assert.deepEqual(
    { ...aggregatedCounts },
    {
      logo_count: 1,
      pwa_icon_count: 1,
      hero_count: 1,
      bottom_nav_icon_count: 1,
      section_icon_count: 1,
      section_background_count: 1,
      message_article_background_count: 1,
      message_cta_background_count: 1,
      product_cover_count: 1,
      product_gallery_count: 1,
    },
  );

  const removeIfUnused = sqlite.prepare(
    `UPDATE media_assets SET deleted = 1
     WHERE id = ? AND ${mediaAssetUnreferencedSql('media_assets')}`,
  );
  assert.equal(removeIfUnused.run('asset-1').changes, 0);

  sqlite.exec(`
    UPDATE site_settings SET logo_asset_id = NULL, pwa_icon_asset_id = NULL;
    DELETE FROM site_hero_slides;
    DELETE FROM site_bottom_navigation;
    UPDATE sections SET icon_asset_id = NULL, browse_background_asset_id = NULL;
    DELETE FROM message_article_references;
    DELETE FROM message_cta_cards;
    DELETE FROM products;
    DELETE FROM product_media;
  `);
  assert.equal(removeIfUnused.run('asset-1').changes, 1);
  sqlite.close();
});
