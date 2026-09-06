import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const migration = readFileSync(
  new URL('../../../migrations/0031_message_article_references.sql', import.meta.url),
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
