import type { MessageArticlePlacementInput } from './api';

export type MessageArticleDraft = MessageArticlePlacementInput;

export function normalizeDraft(
  placements: Array<{ articleId: string; backgroundMediaId: string | null }>,
): MessageArticleDraft[] {
  const seen = new Set<string>();
  return placements.filter((placement) => {
    if (seen.has(placement.articleId)) return false;
    seen.add(placement.articleId);
    return true;
  });
}

export function addDraftArticle(
  draft: MessageArticleDraft[],
  articleId: string,
): MessageArticleDraft[] {
  if (draft.some((placement) => placement.articleId === articleId)) return draft;
  return [...draft, { articleId, backgroundMediaId: null }];
}

export function removeDraftArticle(
  draft: MessageArticleDraft[],
  articleId: string,
): MessageArticleDraft[] {
  return draft.filter((placement) => placement.articleId !== articleId);
}

export function moveDraftArticle(
  draft: MessageArticleDraft[],
  articleId: string,
  direction: -1 | 1,
): MessageArticleDraft[] {
  const index = draft.findIndex((placement) => placement.articleId === articleId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= draft.length) return draft;
  const next = [...draft];
  const [placement] = next.splice(index, 1);
  if (!placement) return draft;
  next.splice(target, 0, placement);
  return next;
}

export function setDraftBackground(
  draft: MessageArticleDraft[],
  articleId: string,
  backgroundMediaId: string | null,
): MessageArticleDraft[] {
  return draft.map((placement) =>
    placement.articleId === articleId ? { ...placement, backgroundMediaId } : placement,
  );
}

export function draftsEqual(a: MessageArticleDraft[], b: MessageArticleDraft[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (placement, index) =>
      placement.articleId === b[index]?.articleId &&
      placement.backgroundMediaId === b[index]?.backgroundMediaId,
  );
}

export function toCanonicalPayload(draft: MessageArticleDraft[]): {
  articles: MessageArticlePlacementInput[];
} {
  return {
    articles: draft.map(({ articleId, backgroundMediaId }) => ({
      articleId,
      backgroundMediaId,
    })),
  };
}
