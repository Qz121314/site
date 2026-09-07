import { AdminApiError } from '../../api';
import { adminFetch } from '../../admin-fetch';

export type MessageArticlePlacement = {
  articleId: string;
  title: string;
  backgroundMediaId: string | null;
  sortOrder: number;
};

export type MessageArticlePlacementInput = {
  articleId: string;
  backgroundMediaId: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('application/json') ? response.json() : null;
}

function parsePlacement(value: unknown): MessageArticlePlacement {
  const placement = asRecord(value);
  if (
    !placement ||
    typeof placement.articleId !== 'string' ||
    typeof placement.title !== 'string' ||
    (typeof placement.backgroundMediaId !== 'string' &&
      placement.backgroundMediaId !== null) ||
    typeof placement.sortOrder !== 'number'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'Messages 文章配置返回数据无效。');
  }
  return {
    articleId: placement.articleId,
    title: placement.title,
    backgroundMediaId: placement.backgroundMediaId,
    sortOrder: placement.sortOrder,
  };
}

function parseEnvelope(value: unknown): MessageArticlePlacement[] {
  const articles = asRecord(value)?.articles;
  if (!Array.isArray(articles)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'Messages 文章配置返回数据无效。');
  }
  return articles.map(parsePlacement).sort((a, b) => a.sortOrder - b.sortOrder);
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await adminFetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  const body = await readJson(response);
  if (!response.ok) {
    const error = asRecord(asRecord(body)?.error);
    throw new AdminApiError(
      response.status,
      typeof error?.code === 'string' ? error.code : 'MESSAGE_ARTICLES_REQUEST_FAILED',
      typeof error?.message === 'string' ? error.message : 'Messages 文章配置请求失败。',
    );
  }
  return body;
}

export function fetchMessageArticlePlacements(): Promise<MessageArticlePlacement[]> {
  return requestJson('/api/admin/message-articles').then(parseEnvelope);
}

export function saveMessageArticlePlacements(
  articles: MessageArticlePlacementInput[],
): Promise<MessageArticlePlacement[]> {
  return requestJson('/api/admin/message-articles', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
    },
    body: JSON.stringify({ articles }),
  }).then(parseEnvelope);
}
