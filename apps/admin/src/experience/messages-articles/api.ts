import { AdminApiError } from '../../api';
import { adminFetch } from '../../admin-fetch';

export type MessageArticlePlacement = {
  id: string;
  title: string;
  backgroundMediaId: string | null;
  targetKind: 'article' | 'link';
  targetRef: string;
  targetLabel: string;
  sectionId: string | null;
  conversionGroupId: string | null;
  sortOrder: number;
};

export type MessageArticlePlacementInput = {
  id?: string;
  title: string;
  backgroundMediaId: string | null;
  targetKind: 'article' | 'link';
  targetRef: string;
  sectionId: string | null;
  conversionGroupId: string | null;
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
    typeof placement.id !== 'string' ||
    typeof placement.title !== 'string' ||
    (typeof placement.backgroundMediaId !== 'string' &&
      placement.backgroundMediaId !== null) ||
    !['article', 'link'].includes(String(placement.targetKind)) ||
    typeof placement.targetRef !== 'string' ||
    typeof placement.targetLabel !== 'string' ||
    (placement.sectionId !== null && typeof placement.sectionId !== 'string') ||
    (placement.conversionGroupId !== null &&
      typeof placement.conversionGroupId !== 'string') ||
    typeof placement.sortOrder !== 'number'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'Messages 卡片配置返回数据无效。');
  }
  return {
    id: placement.id,
    title: placement.title,
    backgroundMediaId: placement.backgroundMediaId,
    targetKind: placement.targetKind as MessageArticlePlacement['targetKind'],
    targetRef: placement.targetRef,
    targetLabel: placement.targetLabel,
    sectionId: typeof placement.sectionId === 'string' ? placement.sectionId : null,
    conversionGroupId:
      typeof placement.conversionGroupId === 'string'
        ? placement.conversionGroupId
        : null,
    sortOrder: placement.sortOrder,
  };
}

function parseEnvelope(value: unknown): MessageArticlePlacement[] {
  const cards = asRecord(value)?.cards;
  if (!Array.isArray(cards)) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'Messages 卡片配置返回数据无效。');
  }
  return cards.map(parsePlacement).sort((a, b) => a.sortOrder - b.sortOrder);
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

export type MessageCardOptions = {
  articles: Array<{ id: string; title: string }>;
  conversionGroups: Array<{
    id: string;
    section_id: string;
    name: string;
    section_name: string;
  }>;
};

export function fetchMessageCardOptions(): Promise<MessageCardOptions> {
  return requestJson('/api/admin/message-articles/options').then((value) => {
    const result = asRecord(value);
    return {
      articles: Array.isArray(result?.articles)
        ? (result.articles as MessageCardOptions['articles'])
        : [],
      conversionGroups: Array.isArray(result?.conversionGroups)
        ? (result.conversionGroups as MessageCardOptions['conversionGroups'])
        : [],
    };
  });
}

export function saveMessageArticlePlacements(
  cards: MessageArticlePlacementInput[],
): Promise<MessageArticlePlacement[]> {
  return requestJson('/api/admin/message-articles', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-admin-request': '1',
    },
    body: JSON.stringify({ cards }),
  }).then(parseEnvelope);
}
