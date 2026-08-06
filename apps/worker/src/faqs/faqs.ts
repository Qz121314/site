export type FaqRecord = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type FaqInput = {
  title: string;
  body: string;
};

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  created_at: string;
  updated_at: string;
};

type ValidationResult =
  | { ok: true; value: FaqInput }
  | { ok: false; field: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequiredText(
  value: unknown,
  field: string,
  label: string,
): { ok: true; value: string } | { ok: false; field: string; message: string } {
  if (typeof value !== 'string') {
    return { ok: false, field, message: `${label}必须是文本。` };
  }

  const normalized = value.trim();
  if (!normalized) {
    return { ok: false, field, message: `请填写${label}。` };
  }

  return { ok: true, value: normalized };
}

export function validateFaqInput(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, field: 'form', message: 'FAQ 数据无效。' };
  }

  const title = readRequiredText(value.title, 'title', '标题');
  if (!title.ok) return title;

  const body = readRequiredText(value.body, 'body', '正文');
  if (!body.ok) return body;

  return {
    ok: true,
    value: {
      title: title.value,
      body: body.value,
    },
  };
}

function mapFaq(row: FaqRow): FaqRecord {
  return {
    id: row.id,
    title: row.question,
    body: row.answer,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const FAQ_SELECT = `SELECT
  id,
  question,
  answer,
  created_at,
  updated_at
FROM faqs`;

export async function listFaqs(db: D1Database): Promise<FaqRecord[]> {
  const result = await db
    .prepare(
      `${FAQ_SELECT}
       WHERE deleted_at IS NULL
       ORDER BY updated_at DESC, question COLLATE NOCASE ASC`,
    )
    .all<FaqRow>();

  return result.results.map(mapFaq);
}

export async function getFaq(db: D1Database, id: string): Promise<FaqRecord | null> {
  const row = await db
    .prepare(`${FAQ_SELECT} WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<FaqRow>();
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
    createdAt: now,
    updatedAt: now,
  };

  return {
    faq,
    statement: db
      .prepare(
        `INSERT INTO faqs (
           id, question, answer, sort_order, is_enabled, created_at, updated_at, deleted_at
         ) VALUES (?, ?, ?, 0, 1, ?, ?, NULL)`,
      )
      .bind(faq.id, faq.title, faq.body, faq.createdAt, faq.updatedAt),
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
       SET question = ?, answer = ?, is_enabled = 1, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(input.title, input.body, now, id);
}

export function createDeleteFaqStatement(db: D1Database, id: string): D1PreparedStatement {
  return db.prepare('DELETE FROM faqs WHERE id = ? AND deleted_at IS NULL').bind(id);
}

export function isFaqConflictError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('faqs_active_question_unique') ||
      error.message.includes('UNIQUE constraint failed: faqs.question') ||
      error.message.includes('UNIQUE constraint failed: index'))
  );
}
