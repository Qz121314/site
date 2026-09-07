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
const MAX_REFERENCE_ID_LENGTH = 120;

type MessageArticleReference = {
  articleId: string;
  title: string;
  backgroundMediaId: string | null;
  sortOrder: number;
  enabled: boolean;
};

type MessageArticlePlacementInput = {
  articleId: string;
  backgroundMediaId: string | null;
};

type ParsedMessageArticleInput = {
  placements: MessageArticlePlacementInput[];
  legacyArticleIds: string[] | null;
};

function validReferenceId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_REFERENCE_ID_LENGTH
  );
}

function parseLegacyArticleIds(value: unknown): ParsedMessageArticleInput | null {
  if (!isRecord(value) || !Array.isArray(value.articleIds)) return null;
  if (value.articleIds.length > MAX_MESSAGE_ARTICLES) return null;
  const articleIds = value.articleIds.filter(validReferenceId);
  if (articleIds.length !== value.articleIds.length) return null;
  if (new Set(articleIds).size !== articleIds.length) return null;
  return {
    placements: articleIds.map((articleId) => ({
      articleId,
      backgroundMediaId: null,
    })),
    legacyArticleIds: articleIds,
  };
}

function parsePlacement(value: unknown): MessageArticlePlacementInput | null {
  if (!isRecord(value) || !validReferenceId(value.articleId) || 'isEnabled' in value)
    return null;
  const rawBackground = value.backgroundMediaId;
  const backgroundMediaId =
    rawBackground === undefined || rawBackground === null
      ? null
      : validReferenceId(rawBackground)
        ? rawBackground
        : undefined;
  if (backgroundMediaId === undefined) return null;
  return { articleId: value.articleId, backgroundMediaId };
}

function parsePlacementInput(value: unknown): ParsedMessageArticleInput | null {
  const legacy = parseLegacyArticleIds(value);
  if (legacy) return legacy;

  const rawArticles = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.articles)
      ? value.articles
      : null;
  if (!rawArticles || rawArticles.length > MAX_MESSAGE_ARTICLES) return null;
  const placements = rawArticles.map(parsePlacement);
  if (placements.some((placement) => placement === null)) return null;
  const validPlacements = placements.filter(
    (placement): placement is MessageArticlePlacementInput => placement !== null,
  );
  const articleIds = validPlacements.map((placement) => placement.articleId);
  if (new Set(articleIds).size !== articleIds.length) return null;
  return { placements: validPlacements, legacyArticleIds: null };
}

async function listReferences(db: D1Database): Promise<MessageArticleReference[]> {
  const rows = (
    await db
      .prepare(
        `SELECT mar.article_id,
                CASE WHEN background.id IS NOT NULL THEN mar.background_media_id ELSE NULL END AS background_media_id,
                mar.sort_order, mar.is_enabled, f.question
         FROM message_article_references mar
         JOIN faqs f ON f.id = mar.article_id
         LEFT JOIN media_assets background
           ON background.id = mar.background_media_id
          AND background.status = 'ready'
          AND background.deleted_at IS NULL
         WHERE f.deleted_at IS NULL
         ORDER BY mar.sort_order ASC, mar.article_id ASC`,
      )
      .all<{
        article_id: string;
        background_media_id?: string | null;
        sort_order: number;
        is_enabled: number;
        question: string;
      }>()
  ).results;
  return rows.map((row) => ({
    articleId: row.article_id,
    title: row.question,
    backgroundMediaId: row.background_media_id ?? null,
    sortOrder: row.sort_order,
    enabled: row.is_enabled === 1,
  }));
}

async function validateArticles(db: D1Database, articleIds: string[]): Promise<boolean> {
  if (articleIds.length === 0) return true;
  const placeholders = articleIds.map(() => '?').join(', ');
  const rows = (
    await db
      .prepare(`SELECT id FROM faqs WHERE deleted_at IS NULL AND id IN (${placeholders})`)
      .bind(...articleIds)
      .all<{ id: string }>()
  ).results;
  return rows.length === articleIds.length;
}

async function validateBackgroundMedia(
  db: D1Database,
  mediaIds: string[],
): Promise<boolean> {
  if (mediaIds.length === 0) return true;
  const placeholders = mediaIds.map(() => '?').join(', ');
  const rows = (
    await db
      .prepare(
        `SELECT id
         FROM media_assets
         WHERE id IN (${placeholders})
           AND status = 'ready'
           AND deleted_at IS NULL
           AND mime_type LIKE 'image/%'`,
      )
      .bind(...mediaIds)
      .all<{ id: string }>()
  ).results;
  return rows.length === mediaIds.length;
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
  const parsed = parsePlacementInput(body);
  if (!parsed) {
    return apiError(
      context,
      400,
      'INVALID_MESSAGE_ARTICLES',
      'Messages 文章配置无效或包含重复文章。',
    );
  }

  const articleIds = parsed.placements.map((placement) => placement.articleId);
  if (!(await validateArticles(context.env.DB, articleIds))) {
    return apiError(
      context,
      400,
      'MESSAGE_ARTICLE_NOT_AVAILABLE',
      '所选文章不存在或已进入回收站。',
    );
  }

  const backgroundMediaIds = [
    ...new Set(
      parsed.placements
        .map((placement) => placement.backgroundMediaId)
        .filter((mediaId): mediaId is string => mediaId !== null),
    ),
  ];
  if (!(await validateBackgroundMedia(context.env.DB, backgroundMediaIds))) {
    return apiError(
      context,
      400,
      'MESSAGE_ARTICLE_BACKGROUND_NOT_AVAILABLE',
      '所选背景图片不存在、已删除或状态异常。',
      { field: 'backgroundMediaId' },
    );
  }

  const now = new Date().toISOString();
  const requestId = context.get('requestId');
  const insertStatements = parsed.legacyArticleIds
    ? parsed.legacyArticleIds.map((articleId, sortOrder) =>
        context.env.DB.prepare(
          `INSERT INTO message_article_references (
               article_id, sort_order, is_enabled, created_at, updated_at
             ) VALUES (?, ?, 1, ?, ?)`,
        ).bind(articleId, sortOrder, now, now),
      )
    : parsed.placements.map((placement, sortOrder) =>
        context.env.DB.prepare(
          `INSERT INTO message_article_references (
               article_id, background_media_id, sort_order, is_enabled, created_at, updated_at
             ) VALUES (?, ?, ?, 1, ?, ?)`,
        ).bind(placement.articleId, placement.backgroundMediaId, sortOrder, now, now),
      );

  await context.env.DB.batch([
    context.env.DB.prepare('DELETE FROM message_article_references'),
    ...insertStatements,
    createAuditLogStatement(context.env.DB, {
      action: 'messages.articles_updated',
      entityType: 'message_article_reference',
      entityId: 'messages',
      requestId,
      metadata: parsed.legacyArticleIds
        ? { articleIds: parsed.legacyArticleIds }
        : {
            articleIds,
            placements: parsed.placements.map((placement) => ({
              articleId: placement.articleId,
              backgroundMediaId: placement.backgroundMediaId,
            })),
          },
      createdAt: now,
    }),
  ]);

  return context.json({ articles: await listReferences(context.env.DB) });
});
