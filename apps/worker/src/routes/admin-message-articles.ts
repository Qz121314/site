import { Hono } from 'hono';
import { createAuditLogStatement } from '../audit/write-audit-log';
import { apiError } from '../http/api-response';
import type { AppEnvironment } from '../types';
import {
  hasAdminRequestHeader,
  isRecord,
  jsonBodyError,
  readJsonBody,
} from './admin-section-shared';

const MAX_MESSAGE_ARTICLES = 100;

type MessageArticleReference = {
  articleId: string;
  title: string;
  sortOrder: number;
  enabled: boolean;
};

function parseArticleIds(value: unknown): string[] | null {
  if (!isRecord(value) || !Array.isArray(value.articleIds)) return null;
  if (value.articleIds.length > MAX_MESSAGE_ARTICLES) return null;
  const articleIds = value.articleIds.filter(
    (articleId): articleId is string =>
      typeof articleId === 'string' &&
      articleId.length > 0 &&
      articleId.length <= 120,
  );
  if (articleIds.length !== value.articleIds.length) return null;
  return new Set(articleIds).size === articleIds.length ? articleIds : null;
}

async function listReferences(db: D1Database): Promise<MessageArticleReference[]> {
  const rows = (
    await db
      .prepare(
        `SELECT mar.article_id, mar.sort_order, mar.is_enabled, f.question
         FROM message_article_references mar
         JOIN faqs f ON f.id = mar.article_id
         WHERE f.deleted_at IS NULL
         ORDER BY mar.sort_order ASC, mar.article_id ASC`,
      )
      .all<{
        article_id: string;
        sort_order: number;
        is_enabled: number;
        question: string;
      }>()
  ).results;
  return rows.map((row) => ({
    articleId: row.article_id,
    title: row.question,
    sortOrder: row.sort_order,
    enabled: row.is_enabled === 1,
  }));
}

export const adminMessageArticleRoutes = new Hono<AppEnvironment>();

adminMessageArticleRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  return context.json({ articles: await listReferences(context.env.DB) });
});

adminMessageArticleRoutes.put('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context)) {
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  }

  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  const articleIds = parseArticleIds(body);
  if (!articleIds) {
    return apiError(
      context,
      400,
      'INVALID_MESSAGE_ARTICLES',
      'Messages 文章配置无效或包含重复文章。',
    );
  }

  if (articleIds.length > 0) {
    const placeholders = articleIds.map(() => '?').join(', ');
    const rows = (
      await context.env.DB.prepare(
        `SELECT id FROM faqs WHERE deleted_at IS NULL AND id IN (${placeholders})`,
      )
        .bind(...articleIds)
        .all<{ id: string }>()
    ).results;
    if (rows.length !== articleIds.length) {
      return apiError(
        context,
        400,
        'MESSAGE_ARTICLE_NOT_AVAILABLE',
        '所选文章不存在或已进入回收站。',
      );
    }
  }

  const now = new Date().toISOString();
  const requestId = context.get('requestId');
  await context.env.DB.batch([
    context.env.DB.prepare('DELETE FROM message_article_references'),
    ...articleIds.map((articleId, sortOrder) =>
      context.env.DB
        .prepare(
          `INSERT INTO message_article_references (
             article_id, sort_order, is_enabled, created_at, updated_at
           ) VALUES (?, ?, 1, ?, ?)`,
        )
        .bind(articleId, sortOrder, now, now),
    ),
    createAuditLogStatement(context.env.DB, {
      action: 'messages.articles_updated',
      entityType: 'message_article_reference',
      entityId: 'messages',
      requestId,
      metadata: { articleIds },
      createdAt: now,
    }),
  ]);

  return context.json({ articles: await listReferences(context.env.DB) });
});
