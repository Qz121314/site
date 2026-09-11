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

const MAX_CARDS = 100;
const MAX_ID_LENGTH = 120;
const MAX_TITLE_LENGTH = 300;
const MAX_TARGET_LENGTH = 1000;
type TargetKind = 'article' | 'link';

type MessageCard = {
  id: string;
  title: string;
  backgroundMediaId: string | null;
  targetKind: TargetKind;
  targetRef: string;
  targetLabel: string;
  sectionId: string | null;
  conversionGroupId: string | null;
  sortOrder: number;
  enabled: boolean;
};

type MessageCardInput = {
  id?: string;
  title: string;
  backgroundMediaId: string | null;
  targetKind: TargetKind;
  targetRef: string;
  sectionId: string | null;
  conversionGroupId: string | null;
};

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

function validTargetKind(value: unknown): value is TargetKind {
  return value === 'article' || value === 'link';
}

function parseCard(value: unknown): MessageCardInput | null {
  if (!isRecord(value)) return null;
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const targetRef = typeof value.targetRef === 'string' ? value.targetRef.trim() : '';
  const backgroundMediaId =
    value.backgroundMediaId === null || value.backgroundMediaId === undefined
      ? null
      : validId(value.backgroundMediaId)
        ? value.backgroundMediaId
        : undefined;
  const sectionId =
    value.sectionId === null || value.sectionId === undefined
      ? null
      : validId(value.sectionId)
        ? value.sectionId
        : undefined;
  const conversionGroupId =
    value.conversionGroupId === null || value.conversionGroupId === undefined
      ? null
      : validId(value.conversionGroupId)
        ? value.conversionGroupId
        : undefined;
  if (
    (value.id !== undefined && !validId(value.id)) ||
    !title ||
    title.length > MAX_TITLE_LENGTH ||
    !validTargetKind(value.targetKind) ||
    !targetRef ||
    targetRef.length > MAX_TARGET_LENGTH ||
    backgroundMediaId === undefined ||
    sectionId === undefined ||
    conversionGroupId === undefined
  )
    return null;
  return {
    ...(typeof value.id === 'string' ? { id: value.id } : {}),
    title,
    backgroundMediaId,
    targetKind: value.targetKind,
    targetRef,
    sectionId,
    conversionGroupId,
  };
}

function parseCards(value: unknown): MessageCardInput[] | null {
  const raw = isRecord(value) && Array.isArray(value.cards) ? value.cards : value;
  if (!Array.isArray(raw) || raw.length > MAX_CARDS) return null;
  const cards = raw.map(parseCard);
  if (cards.some((card) => card === null)) return null;
  const ids = cards.map((card) => card?.id).filter((id): id is string => Boolean(id));
  if (new Set(ids).size !== ids.length) return null;
  return cards.filter((card): card is MessageCardInput => card !== null);
}

async function listCards(db: D1Database): Promise<MessageCard[]> {
  const rows = (
    await db
      .prepare(
        `SELECT c.id, c.title, c.background_media_id, c.target_kind, c.target_ref,
                c.section_id, c.conversion_group_id, c.sort_order, c.is_enabled,
                COALESCE(f.question, c.target_ref) AS target_label
         FROM message_cta_cards c
         LEFT JOIN faqs f ON c.target_kind = 'article' AND f.id = c.target_ref
         WHERE c.is_enabled = 1
         ORDER BY c.sort_order ASC, c.id ASC`,
      )
      .all<{
        id: string;
        title: string;
        background_media_id: string | null;
        target_kind: TargetKind;
        target_ref: string;
        target_label: string;
        section_id: string | null;
        conversion_group_id: string | null;
        sort_order: number;
        is_enabled: number;
      }>()
  ).results;
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    backgroundMediaId: row.background_media_id,
    targetKind: row.target_kind,
    targetRef: row.target_ref,
    targetLabel: row.target_label,
    sectionId: row.section_id,
    conversionGroupId: row.conversion_group_id,
    sortOrder: row.sort_order,
    enabled: row.is_enabled === 1,
  }));
}

async function validateTargets(
  db: D1Database,
  cards: MessageCardInput[],
): Promise<string | null> {
  for (const card of cards) {
    if (card.targetKind === 'link') {
      try {
        const url = new URL(card.targetRef);
        if (url.protocol !== 'http:' && url.protocol !== 'https:')
          return '链接必须使用 http 或 https。';
      } catch {
        return '外部链接格式无效。';
      }
    } else if (card.targetKind === 'article') {
      const row = await db
        .prepare('SELECT id FROM faqs WHERE id = ? AND deleted_at IS NULL')
        .bind(card.targetRef)
        .first();
      if (!row) return '所选文章不存在或已进入回收站。';
    }
  }
  return null;
}

async function validateReferences(
  db: D1Database,
  cards: MessageCardInput[],
): Promise<string | null> {
  const mediaIds = [
    ...new Set(
      cards
        .map((card) => card.backgroundMediaId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (mediaIds.length) {
    const placeholders = mediaIds.map(() => '?').join(', ');
    const rows = await db
      .prepare(
        `SELECT id FROM media_assets WHERE id IN (${placeholders}) AND status = 'ready' AND deleted_at IS NULL AND mime_type LIKE 'image/%'`,
      )
      .bind(...mediaIds)
      .all();
    if (rows.results.length !== mediaIds.length)
      return '背景图不存在、已删除或状态异常。';
  }
  for (const card of cards) {
    if ((card.sectionId === null) !== (card.conversionGroupId === null))
      return '转化池绑定信息不完整。';
    if (card.sectionId && card.conversionGroupId) {
      const group = await db
        .prepare(
          'SELECT id FROM conversion_groups WHERE section_id = ? AND id = ? AND deleted_at IS NULL AND is_enabled = 1',
        )
        .bind(card.sectionId, card.conversionGroupId)
        .first();
      if (!group) return '所选转化池不存在或已停用。';
    }
  }
  return null;
}

export const adminMessageArticleRoutes = new Hono<AppEnvironment>();

adminMessageArticleRoutes.get('/options', async (context) => {
  context.header('Cache-Control', 'no-store');
  const [articles, groups] = await Promise.all([
    context.env.DB.prepare(
      'SELECT id, question AS title FROM faqs WHERE deleted_at IS NULL AND is_enabled = 1 ORDER BY sort_order ASC, created_at ASC',
    ).all(),
    context.env.DB.prepare(
      'SELECT cg.id, cg.section_id, cg.name, s.name AS section_name FROM conversion_groups cg JOIN sections s ON s.id = cg.section_id WHERE cg.deleted_at IS NULL AND cg.is_enabled = 1 AND s.deleted_at IS NULL ORDER BY s.sort_order ASC, cg.sort_order ASC, cg.created_at ASC',
    ).all(),
  ]);
  return context.json({
    articles: articles.results,
    conversionGroups: groups.results,
  });
});

adminMessageArticleRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  return context.json({ cards: await listCards(context.env.DB) });
});

adminMessageArticleRoutes.put('/', async (context) => {
  context.header('Cache-Control', 'no-store');
  if (!hasAdminRequestHeader(context))
    return apiError(context, 403, 'ADMIN_REQUEST_REQUIRED', '后台请求标识无效。');
  let body: unknown;
  try {
    body = await readJsonBody(context);
  } catch (error) {
    return jsonBodyError(context, error);
  }
  const cards = parseCards(body);
  if (!cards)
    return apiError(context, 400, 'INVALID_MESSAGE_CARDS', 'Message 卡片配置无效。');
  const targetError = await validateTargets(context.env.DB, cards);
  if (targetError)
    return apiError(context, 400, 'MESSAGE_CARD_TARGET_INVALID', targetError);
  const referenceError = await validateReferences(context.env.DB, cards);
  if (referenceError)
    return apiError(context, 400, 'MESSAGE_CARD_REFERENCE_INVALID', referenceError);
  const now = new Date().toISOString();
  const rows = cards.map((card, sortOrder) => {
    const id = card.id ?? crypto.randomUUID();
    return context.env.DB.prepare(
      `INSERT INTO message_cta_cards
       (id, title, background_media_id, target_kind, target_ref, section_id,
        conversion_group_id, sort_order, is_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).bind(
      id,
      card.title,
      card.backgroundMediaId,
      card.targetKind,
      card.targetRef,
      card.sectionId,
      card.conversionGroupId,
      sortOrder,
      now,
      now,
    );
  });
  await context.env.DB.batch([
    context.env.DB.prepare('DELETE FROM message_cta_cards'),
    ...rows,
    createAuditLogStatement(context.env.DB, {
      action: 'messages.cards_updated',
      entityType: 'message_cta_card',
      entityId: 'messages',
      requestId: context.get('requestId'),
      metadata: { count: cards.length },
      createdAt: now,
    }),
  ]);
  return context.json({ cards: await listCards(context.env.DB) });
});
