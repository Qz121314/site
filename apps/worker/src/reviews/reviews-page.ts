export type ReviewsPage = {
  title: string;
  body: string;
  isPublished: boolean;
  updatedAt: string;
};

export type ReviewsPageInput = Pick<ReviewsPage, 'title' | 'body' | 'isPublished'>;

type ReviewsPageRow = {
  title: string;
  body: string;
  is_published: number;
  updated_at: string;
};

type ValidationResult =
  { ok: true; value: ReviewsPageInput } | { ok: false; field: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateReviewsPageInput(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, field: 'form', message: 'Reviews 页面数据无效。' };
  }
  if (typeof value.title !== 'string' || !value.title.trim()) {
    return { ok: false, field: 'title', message: '请填写页面标题。' };
  }
  if (value.title.trim().length > 300) {
    return { ok: false, field: 'title', message: '页面标题不能超过 300 个字符。' };
  }
  if (typeof value.body !== 'string' || !value.body.trim()) {
    return { ok: false, field: 'body', message: '请填写 Markdown 正文。' };
  }
  if (value.body.length > 20_000) {
    return { ok: false, field: 'body', message: 'Markdown 正文不能超过 20000 个字符。' };
  }
  if (typeof value.isPublished !== 'boolean') {
    return { ok: false, field: 'isPublished', message: '请选择页面发布状态。' };
  }
  return {
    ok: true,
    value: {
      title: value.title.trim(),
      body: value.body,
      isPublished: value.isPublished,
    },
  };
}

function mapReviewsPage(row: ReviewsPageRow): ReviewsPage {
  return {
    title: row.title,
    body: row.body,
    isPublished: row.is_published === 1,
    updatedAt: row.updated_at,
  };
}

export async function getReviewsPage(db: D1Database): Promise<ReviewsPage | null> {
  const row = await db
    .prepare(
      `SELECT title, body, is_published, updated_at
       FROM reviews_page
       WHERE id = 1`,
    )
    .first<ReviewsPageRow>();
  return row ? mapReviewsPage(row) : null;
}

export function upsertReviewsPageStatement(
  db: D1Database,
  input: ReviewsPageInput,
  updatedAt: string,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO reviews_page (id, title, body, is_published, updated_at)
       VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         body = excluded.body,
         is_published = excluded.is_published,
         updated_at = excluded.updated_at`,
    )
    .bind(input.title, input.body, Number(input.isPublished), updatedAt);
}
