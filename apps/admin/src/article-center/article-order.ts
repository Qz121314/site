import type { AdminArticle } from './api';

export function sortArticlesByDefault(articles: readonly AdminArticle[]): AdminArticle[] {
  return [...articles].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      right.updatedAt.localeCompare(left.updatedAt) ||
      left.title.localeCompare(right.title, 'zh-CN'),
  );
}

export function moveAndNormalizeArticleOrder(
  articles: readonly AdminArticle[],
  articleId: string,
  direction: -1 | 1,
): AdminArticle[] | null {
  const ordered = sortArticlesByDefault(articles);
  const currentIndex = ordered.findIndex((article) => article.id === articleId);
  const targetIndex = currentIndex + direction;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
    return null;
  }

  const [moved] = ordered.splice(currentIndex, 1);
  if (!moved) return null;
  ordered.splice(targetIndex, 0, moved);

  return ordered.map((article, index) => ({
    ...article,
    sortOrder: index * 10,
  }));
}
