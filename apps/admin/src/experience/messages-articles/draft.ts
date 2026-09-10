import type { MessageArticlePlacement } from './api';

export type MessageArticleDraft = MessageArticlePlacement & { id: string };

export function normalizeDraft(placements: MessageArticleDraft[]): MessageArticleDraft[] {
  const seen = new Set<string>();
  return placements.filter((placement) => {
    if (seen.has(placement.id)) return false;
    seen.add(placement.id);
    return true;
  });
}

export function addDraftCard(
  draft: MessageArticleDraft[],
  card: MessageArticleDraft,
  backgroundMediaId: string,
): MessageArticleDraft[] {
  if (draft.some((placement) => placement.targetRef === card.targetRef)) return draft;
  return [...draft, { ...card, backgroundMediaId }];
}

export function removeDraftArticle(
  draft: MessageArticleDraft[],
  cardId: string,
): MessageArticleDraft[] {
  return draft.filter((placement) => placement.id !== cardId);
}

export function moveDraftArticle(
  draft: MessageArticleDraft[],
  cardId: string,
  direction: -1 | 1,
): MessageArticleDraft[] {
  const index = draft.findIndex((placement) => placement.id === cardId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= draft.length) return draft;
  const next = [...draft];
  const [placement] = next.splice(index, 1);
  if (!placement) return draft;
  next.splice(target, 0, placement);
  return next;
}

export function draftsEqual(a: MessageArticleDraft[], b: MessageArticleDraft[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (placement, index) =>
      placement.id === b[index]?.id &&
      placement.backgroundMediaId === b[index]?.backgroundMediaId,
  );
}
