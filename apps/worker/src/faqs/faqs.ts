export type FaqRecord = {
  id: string;
  title: string;
  body: string;
  sortOrder: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type FaqInput = {
  title: string;
  body: string;
  sortOrder: number;
  isEnabled: boolean;
};

export type FaqScope = 'active' | 'trash' | 'all';

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_enabled: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type ValidationResult =
  { ok: true; value: FaqInput } | { ok: false; field: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequiredText(
  value: unknown,
  field: string,
  label: string,
  maxLength: number,
): { ok: true; value: string } | { ok: false; field: string; message: string } {
  if (typeof value !== 'string') {
    return { ok: false, field, message: `${label}必须是文本。` };
  }
  const normalized = value.trim();
  if (!normalized) return { ok: false, field, message: `请填写${label}。` };
  if (normalized.length > maxLength) {
    return { ok: false, field, message: `${label}不能超过 ${maxLength} 个字符。` };
  }
  return { ok: true, value: normalized };
}

export function validateFaqInput(value: unknown): ValidationResult {
  if (!isRecord(value)) return { ok: false, field: 'form', message: 'FAQ 数据无效。' };

  const title = readRequiredText(value.title, 'title', '标题', 300);
  if (!title.ok) return title;
  const body = readRequiredText(value.body, 'body', '正文', 20_000);
  if (!body.ok) return body;

  if (
    typeof value.sortOrder !== 'number' ||
    !Number.isInteger(value.sortOrder) ||
    value.sortOrder < 0 ||
    value.sortOrder > 1_000_000
  ) {
    return { ok: false, field: 'sortOrder', message: '排序必须是 0 到 1000000 的整数。' };
  }
  if (typeof value.isEnabled !== 'boolean') {
    return { ok: false, field: 'isEnabled', message: '必须选择启用或停用。' };
  }

  return {
    ok: true,
    value: {
      title: title.value,
      body: body.value,
      sortOrder: value.sortOrder,
      isEnabled: value.isEnabled,
    },
  };
}

function mapFaq(row: FaqRow): FaqRecord {
  return {
    id: row.id,
    title: row.question,
    body: row.answer,
    sortOrder: row.sort_order,
    isEnabled: row.is_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

const FAQ_SELECT = `SELECT
  id, question, answer, sort_order, is_enabled, created_at, updated_at, deleted_at
FROM faqs`;

export async function listFaqs(
  db: D1Database,
  scope: FaqScope = 'active',
): Promise<FaqRecord[]> {
  const deletedClause =
    scope === 'active'
      ? 'WHERE deleted_at IS NULL'
      : scope === 'trash'
        ? 'WHERE deleted_at IS NOT NULL'
        : '';
  const result = await db
    .prepare(
      `${FAQ_SELECT}
       ${deletedClause}
       ORDER BY sort_order ASC, updated_at DESC, question COLLATE NOCASE ASC`,
    )
    .all<FaqRow>();
  return result.results.map(mapFaq);
}

export async function getFaq(db: D1Database, id: string): Promise<FaqRecord | null> {
  const row = await db.prepare(`${FAQ_SELECT} WHERE id = ?`).bind(id).first<FaqRow>();
  return row ? mapFaq(row) : null;
}

export function createFaq(
  db: D1Database,
  input: FaqInput,
  now: string,
): { faq: FaqRecord; statement: D1PreparedStatement } {
  const faq: FaqRecord = {
    id: crypto.randomUUID(),
    title: input.title,
    body: input.body,
    sortOrder: input.sortOrder,
    isEnabled: input.isEnabled,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  return {
    faq,
    statement: db
      .prepare(
        `INSERT INTO faqs (
           id, question, answer, sort_order, is_enabled, created_at, updated_at, deleted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .bind(
        faq.id,
        faq.title,
        faq.body,
        faq.sortOrder,
        faq.isEnabled ? 1 : 0,
        faq.createdAt,
        faq.updatedAt,
      ),
  };
}

export function createUpdateFaqStatement(
  db: D1Database,
  id: string,
  input: FaqInput,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE faqs
       SET question = ?, answer = ?, sort_order = ?, is_enabled = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(input.title, input.body, input.sortOrder, input.isEnabled ? 1 : 0, now, id);
}

export function createDeleteFaqStatement(
  db: D1Database,
  id: string,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE faqs
       SET is_enabled = 0, deleted_at = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(now, now, id);
}

export function createRestoreFaqStatement(
  db: D1Database,
  id: string,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE faqs
       SET deleted_at = NULL, updated_at = ?
       WHERE id = ? AND deleted_at IS NOT NULL`,
    )
    .bind(now, id);
}

export function createReorderFaqStatement(
  db: D1Database,
  id: string,
  sortOrder: number,
  now: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE faqs SET sort_order = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(sortOrder, now, id);
}

export function isFaqConflictError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('faqs_active_question_unique') ||
      error.message.includes('UNIQUE constraint failed: faqs.question') ||
      error.message.includes('UNIQUE constraint failed: index'))
  );
}
