import type { StorefrontBootstrap } from './content';

export const MESSAGE_ARTICLE_READ_STORAGE_KEY = 'site:messages:read-articles';
const MESSAGE_ARTICLE_READ_EVENT = 'site:messages:read-articles-change';

export type MessageArticleMetadata = {
  cardId: string;
  title: string;
  preview: string;
  targetKind: 'article' | 'page' | 'link';
  targetRef: string;
  sectionId: string | null;
  conversionGroupId: string | null;
  backgroundObjectKey: string | null;
  sortOrder: number;
};

type ReadStorage = Pick<Storage, 'getItem'>;
type ReadWriteStorage = Pick<Storage, 'getItem' | 'setItem'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function browserStorage(): ReadWriteStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function bootstrapMessageArticles(value: unknown): unknown {
  if (!isRecord(value)) return undefined;
  const siteEnvelope = value.site;
  if (!isRecord(siteEnvelope)) return undefined;
  const site = siteEnvelope.site;
  if (!isRecord(site)) return undefined;
  const navigation = site.navigation;
  if (!isRecord(navigation)) return undefined;
  return navigation.messageArticles;
}

function parseMessageArticle(value: unknown): MessageArticleMetadata | null {
  if (!isRecord(value)) return null;
  const cardId = typeof value.cardId === 'string' ? value.cardId.trim() : '';
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const preview = typeof value.preview === 'string' ? value.preview.trim() : '';
  const targetKind = value.targetKind;
  const targetRef = typeof value.targetRef === 'string' ? value.targetRef.trim() : '';
  const sectionId = typeof value.sectionId === 'string' ? value.sectionId.trim() : null;
  const conversionGroupId =
    typeof value.conversionGroupId === 'string' ? value.conversionGroupId.trim() : null;
  const backgroundObjectKey =
    typeof value.backgroundObjectKey === 'string' ? value.backgroundObjectKey.trim() : '';
  const sortOrder = value.sortOrder;
  if (
    !cardId ||
    cardId.length > 120 ||
    !title ||
    !['article', 'page', 'link'].includes(String(targetKind)) ||
    !targetRef ||
    typeof sortOrder !== 'number' ||
    !Number.isFinite(sortOrder)
  ) {
    return null;
  }
  return {
    cardId,
    title,
    preview,
    targetKind: targetKind as MessageArticleMetadata['targetKind'],
    targetRef,
    sectionId,
    conversionGroupId,
    backgroundObjectKey: backgroundObjectKey || null,
    sortOrder,
  };
}

export function getMessageArticlesFromBootstrap(
  bootstrap: StorefrontBootstrap | unknown,
): MessageArticleMetadata[] {
  const raw = bootstrapMessageArticles(bootstrap);
  if (!Array.isArray(raw)) return [];
  const sorted = raw
    .map((value) => parseMessageArticle(value))
    .filter((value): value is MessageArticleMetadata => value !== null)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.cardId.localeCompare(right.cardId) ||
        left.title.localeCompare(right.title),
    );
  const seen = new Set<string>();
  return sorted.filter((article) => {
    if (seen.has(article.cardId)) return false;
    seen.add(article.cardId);
    return true;
  });
}

function validReadIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (item): item is string =>
          typeof item === 'string' && Boolean(item) && item.length <= 120,
      ),
    ),
  ].sort();
}

export function readMessageArticleReadIds(
  storage: ReadStorage | null = browserStorage(),
): Set<string> {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(MESSAGE_ARTICLE_READ_STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(validReadIds(JSON.parse(raw)));
  } catch {
    return new Set();
  }
}

export function getMessageArticleReadSnapshot(): string {
  return JSON.stringify([...readMessageArticleReadIds()]);
}

export function subscribeMessageArticleReadState(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === MESSAGE_ARTICLE_READ_STORAGE_KEY) callback();
  };
  window.addEventListener(MESSAGE_ARTICLE_READ_EVENT, callback);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(MESSAGE_ARTICLE_READ_EVENT, callback);
    window.removeEventListener('storage', onStorage);
  };
}

export function markMessageArticleRead(
  cardId: string,
  storage: ReadWriteStorage | null = browserStorage(),
  notify = true,
): void {
  const normalized = cardId.trim();
  if (!storage || !normalized || normalized.length > 120) return;
  const readIds = readMessageArticleReadIds(storage);
  if (readIds.has(normalized)) return;
  readIds.add(normalized);
  try {
    storage.setItem(
      MESSAGE_ARTICLE_READ_STORAGE_KEY,
      JSON.stringify([...readIds].sort()),
    );
  } catch {
    return;
  }
  if (notify && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(MESSAGE_ARTICLE_READ_EVENT));
  }
}

export function countUnreadMessageArticles(
  activeArticles: MessageArticleMetadata[],
  readIds: ReadonlySet<string>,
): number {
  const activeIds = new Set(
    activeArticles.map((article) => article.cardId).filter((cardId) => cardId),
  );
  let unread = 0;
  for (const cardId of activeIds) {
    if (!readIds.has(cardId)) unread += 1;
  }
  return unread;
}

function safeUnread(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function composeMessagesBadge(
  supportUnread: number,
  articleUnread: number,
): number {
  return safeUnread(supportUnread) + safeUnread(articleUnread);
}
