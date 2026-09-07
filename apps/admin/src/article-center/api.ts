import {
  batchDeleteFaqs,
  createFaq,
  deleteFaq,
  fetchFaqs,
  reorderFaqs,
  restoreFaq,
  updateFaq,
  type AdminFaq,
  type FaqInput,
} from '../faq-management/api';

export type ArticleScope = 'active' | 'trash';

export type AdminArticle = {
  id: string;
  title: string;
  body: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ArticleInput = {
  title: string;
  body: string;
  sortOrder: number;
  isActive: boolean;
};

function fromLegacyFaq(faq: AdminFaq): AdminArticle {
  return {
    id: faq.id,
    title: faq.title,
    body: faq.body,
    sortOrder: faq.sortOrder,
    isActive: faq.isEnabled,
    createdAt: faq.createdAt,
    updatedAt: faq.updatedAt,
    deletedAt: faq.deletedAt,
  };
}

function toLegacyFaqInput(input: ArticleInput): FaqInput {
  return {
    title: input.title,
    body: input.body,
    sortOrder: input.sortOrder,
    isEnabled: input.isActive,
  };
}

// Product semantics are Article. The compatibility transport intentionally remains FAQ:
// /api/admin/faqs -> legacy FAQ record -> D1 faqs.question/answer.
export async function fetchArticles(
  scope: ArticleScope = 'active',
): Promise<AdminArticle[]> {
  return (await fetchFaqs(scope)).map(fromLegacyFaq);
}

export async function createArticle(
  input: ArticleInput,
): Promise<AdminArticle> {
  return fromLegacyFaq(await createFaq(toLegacyFaqInput(input)));
}

export async function updateArticle(
  id: string,
  input: ArticleInput,
): Promise<AdminArticle> {
  return fromLegacyFaq(await updateFaq(id, toLegacyFaqInput(input)));
}

export async function deleteArticle(id: string): Promise<AdminArticle> {
  return fromLegacyFaq(await deleteFaq(id));
}

export async function restoreArticle(id: string): Promise<AdminArticle> {
  return fromLegacyFaq(await restoreFaq(id));
}

export function batchDeleteArticles(ids: string[]): Promise<string[]> {
  return batchDeleteFaqs(ids);
}

export function reorderArticles(
  items: Array<{ id: string; sortOrder: number }>,
): Promise<void> {
  return reorderFaqs(items);
}
