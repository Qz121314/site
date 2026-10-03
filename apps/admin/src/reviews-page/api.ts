import { AdminApiError } from '../api';
import { adminFetch } from '../admin-fetch';

export type ReviewsPage = {
  title: string;
  body: string;
  isPublished: boolean;
  updatedAt: string;
};

export type ReviewsPageInput = Pick<ReviewsPage, 'title' | 'body' | 'isPublished'>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function readPage(response: Response): Promise<ReviewsPage | null> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = asRecord(asRecord(body)?.error);
    throw new AdminApiError(
      response.status,
      typeof error?.code === 'string' ? error.code : 'REVIEWS_PAGE_REQUEST_FAILED',
      typeof error?.message === 'string' ? error.message : 'Reviews 页面请求失败。',
    );
  }
  const page = asRecord(asRecord(body)?.page);
  if (!page) return null;
  if (
    typeof page.title !== 'string' ||
    typeof page.body !== 'string' ||
    typeof page.isPublished !== 'boolean' ||
    typeof page.updatedAt !== 'string'
  ) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'Reviews 页面返回数据无效。');
  }
  return page as ReviewsPage;
}

export async function fetchReviewsPage(): Promise<ReviewsPage | null> {
  return readPage(
    await adminFetch('/api/admin/reviews-page/', {
      credentials: 'same-origin',
      cache: 'no-store',
    }),
  );
}

export async function saveReviewsPage(input: ReviewsPageInput): Promise<ReviewsPage> {
  const page = await readPage(
    await adminFetch('/api/admin/reviews-page/', {
      method: 'PUT',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        'x-admin-request': '1',
      },
      body: JSON.stringify(input),
    }),
  );
  if (!page) {
    throw new AdminApiError(500, 'INVALID_RESPONSE', 'Reviews 页面保存结果无效。');
  }
  return page;
}
