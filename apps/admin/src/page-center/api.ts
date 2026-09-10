import { AdminApiError } from '../api';
import { adminFetch } from '../admin-fetch';

export type H5Page = {
  id: string;
  slug: string;
  name: string;
  status: 'draft' | 'published' | 'archived';
  publishedVersionId: string | null;
  versionNumber: number | null;
  ctaCount: number;
  productId: string | null;
  productSectionId: string | null;
  createdAt: string;
  updatedAt: string;
  publicUrl: string;
};

export type H5PageDetail = H5Page & {
  versionId: string;
  ctas: Array<{
    id: string;
    key: string;
    label: string;
    filePath: string;
    selector: string;
    sectionId: string | null;
    conversionGroupId: string | null;
  }>;
};

export type H5PublicSettings = {
  publicOrigin: string | null;
  updatedAt: string;
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await adminFetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = record(record(body).error);
    throw new AdminApiError(
      response.status,
      String(error.code ?? 'PAGE_REQUEST_FAILED'),
      String(error.message ?? '页面中心请求失败。'),
    );
  }
  return body;
}

function parsePage(value: unknown): H5Page {
  const page = record(value);
  return {
    id: String(page.id ?? ''),
    slug: String(page.slug ?? ''),
    name: String(page.name ?? ''),
    status:
      page.status === 'published' || page.status === 'archived' ? page.status : 'draft',
    publishedVersionId:
      typeof page.publishedVersionId === 'string' ? page.publishedVersionId : null,
    versionNumber: typeof page.versionNumber === 'number' ? page.versionNumber : null,
    ctaCount: typeof page.ctaCount === 'number' ? page.ctaCount : 0,
    productId: typeof page.productId === 'string' ? page.productId : null,
    productSectionId:
      typeof page.productSectionId === 'string' ? page.productSectionId : null,
    createdAt: String(page.createdAt ?? ''),
    updatedAt: String(page.updatedAt ?? ''),
    publicUrl: String(page.publicUrl ?? ''),
  };
}

export async function fetchH5Pages(): Promise<H5Page[]> {
  const body = record(await request('/api/admin/pages'));
  return Array.isArray(body.pages) ? body.pages.map(parsePage) : [];
}

export async function fetchH5PublicSettings(): Promise<H5PublicSettings> {
  const body = record(await request('/api/admin/pages/settings'));
  const settings = record(body.settings);
  return {
    publicOrigin:
      typeof settings.publicOrigin === 'string' ? settings.publicOrigin : null,
    updatedAt: String(settings.updatedAt ?? ''),
  };
}

export async function saveH5PublicSettings(publicOrigin: string) {
  const body = record(
    await request('/api/admin/pages/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
      body: JSON.stringify({ publicOrigin }),
    }),
  );
  const settings = record(body.settings);
  return {
    publicOrigin:
      typeof settings.publicOrigin === 'string' ? settings.publicOrigin : null,
    updatedAt: String(settings.updatedAt ?? ''),
  };
}

export async function fetchH5Page(pageId: string): Promise<H5PageDetail> {
  const body = record(await request(`/api/admin/pages/${encodeURIComponent(pageId)}`));
  const page = record(body.page);
  return {
    ...parsePage(page),
    versionId: String(page.versionId ?? ''),
    productId: typeof page.productId === 'string' ? page.productId : null,
    ctas: Array.isArray(page.ctas)
      ? page.ctas.map((value) => {
          const cta = record(value);
          return {
            id: String(cta.id ?? ''),
            key: String(cta.key ?? ''),
            label: String(cta.label ?? ''),
            filePath: String(cta.filePath ?? ''),
            selector: String(cta.selector ?? ''),
            sectionId: typeof cta.sectionId === 'string' ? cta.sectionId : null,
            conversionGroupId:
              typeof cta.conversionGroupId === 'string' ? cta.conversionGroupId : null,
          };
        })
      : [],
  };
}

export async function uploadH5Page(formData: FormData): Promise<{
  id: string;
  versionId: string;
  ctas: Array<{ id: string; key: string; label: string }>;
}> {
  const body = record(
    await request('/api/admin/pages/upload', {
      method: 'POST',
      headers: { 'x-admin-request': '1' },
      body: formData,
    }),
  );
  return {
    id: String(body.id ?? ''),
    versionId: String(body.versionId ?? ''),
    ctas: Array.isArray(body.ctas)
      ? body.ctas
          .filter(
            (cta): cta is Record<string, unknown> =>
              typeof cta === 'object' && cta !== null,
          )
          .map((cta) => ({
            id: String(cta.id ?? ''),
            key: String(cta.key ?? ''),
            label: String(cta.label ?? ''),
          }))
      : [],
  };
}

export async function saveH5CtaBindings(
  pageId: string,
  versionId: string,
  bindings: Array<{
    ctaId: string;
    label: string;
    sectionId: string | null;
    conversionGroupId: string | null;
  }>,
) {
  await request(`/api/admin/pages/${encodeURIComponent(pageId)}/ctas`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
    body: JSON.stringify({ versionId, bindings }),
  });
}

export async function saveH5Product(
  pageId: string,
  sectionId: string,
): Promise<{ id: string; slug: string; sectionId: string }> {
  const body = record(
    await request(`/api/admin/pages/${encodeURIComponent(pageId)}/product`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
      body: JSON.stringify({ sectionId }),
    }),
  );
  const product = record(body.product);
  return {
    id: String(product.id ?? ''),
    slug: String(product.slug ?? ''),
    sectionId: String(product.sectionId ?? ''),
  };
}

export async function updateH5PageName(pageId: string, name: string) {
  await request(`/api/admin/pages/${encodeURIComponent(pageId)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
    body: JSON.stringify({ name }),
  });
}

export async function publishH5Page(pageId: string) {
  await request(`/api/admin/pages/${encodeURIComponent(pageId)}/publish`, {
    method: 'POST',
    headers: { 'x-admin-request': '1' },
  });
}

export async function deleteH5Page(pageId: string) {
  await request(`/api/admin/pages/${encodeURIComponent(pageId)}`, {
    method: 'DELETE',
    headers: { 'x-admin-request': '1' },
  });
}
