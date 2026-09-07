import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const migration = readFileSync(
  new URL('../../../migrations/0031_message_article_references.sql', import.meta.url),
  'utf8',
);
const presentationMigration = readFileSync(
  new URL(
    '../../../migrations/0032_message_article_background_media.sql',
    import.meta.url,
  ),
  'utf8',
);

const NOW = '2026-09-06T12:00:00.000Z';

test('0031 prunes a Messages Article reference on Article soft delete without deleting the Article row', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`
      CREATE TABLE faqs (
        id TEXT PRIMARY KEY,
        deleted_at TEXT
      );
    `);
    db.exec(migration);

    db.prepare('INSERT INTO faqs (id, deleted_at) VALUES (?, NULL)').run('article-a');
    db.prepare(
      `INSERT INTO message_article_references (
         article_id, sort_order, is_enabled, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?)`,
    ).run('article-a', 0, 1, NOW, NOW);

    db.prepare('UPDATE faqs SET deleted_at = ? WHERE id = ?').run(NOW, 'article-a');

    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM message_article_references').get().count,
      0,
    );
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM faqs').get().count, 1);
  } finally {
    db.close();
  }
});

test('0032 adds a nullable background media placement reference without disturbing existing rows', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE media_assets (id TEXT PRIMARY KEY);
      CREATE TABLE faqs (id TEXT PRIMARY KEY, deleted_at TEXT);
    `);
    db.exec(migration);
    db.prepare('INSERT INTO faqs (id, deleted_at) VALUES (?, NULL)').run('article-a');
    db.prepare('INSERT INTO media_assets (id) VALUES (?)').run('media-a');
    db.prepare(
      `INSERT INTO message_article_references (
         article_id, sort_order, is_enabled, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?)`,
    ).run('article-a', 7, 1, NOW, NOW);

    db.exec(presentationMigration);

    const columns = db.prepare('PRAGMA table_info(message_article_references)').all();
    const background = columns.find((column) => column.name === 'background_media_id');
    assert.ok(background);
    assert.equal(background.notnull, 0);
    const preserved = db
      .prepare(
        'SELECT article_id, background_media_id, sort_order, is_enabled FROM message_article_references',
      )
      .get();
    assert.equal(preserved.article_id, 'article-a');
    assert.equal(preserved.background_media_id, null);
    assert.equal(preserved.sort_order, 7);
    assert.equal(preserved.is_enabled, 1);

    db.prepare(
      'UPDATE message_article_references SET background_media_id = ? WHERE article_id = ?',
    ).run('media-a', 'article-a');
    db.prepare('DELETE FROM media_assets WHERE id = ?').run('media-a');
    assert.equal(
      db
        .prepare(
          'SELECT background_media_id FROM message_article_references WHERE article_id = ?',
        )
        .get('article-a').background_media_id,
      null,
    );
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM message_article_references').get().count,
      1,
    );
  } finally {
    db.close();
  }
});
