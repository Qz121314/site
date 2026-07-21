export const MAX_PUBLIC_PRODUCT_PAGE = 500;

export type PublicPageInput = {
  page: number;
  valid: boolean;
};

export function readPublicPage(value: string | null): PublicPageInput {
  if (value === null) return { page: 1, valid: true };
  if (!/^[1-9]\d*$/u.test(value)) return { page: 1, valid: false };

  const page = Number(value);
  return Number.isSafeInteger(page) && page <= MAX_PUBLIC_PRODUCT_PAGE
    ? { page, valid: true }
    : { page: 1, valid: false };
}

export function publicPageHref(url: URL, page: number): string {
  const query = page > 1 ? `?page=${encodeURIComponent(String(page))}` : "";
  return `${url.pathname}${query}`;
}

export function publicPageCanonical(url: URL, page: number): string {
  const canonical = new URL(url.pathname, url.origin);
  if (page > 1) canonical.searchParams.set("page", String(page));
  return canonical.href;
}
