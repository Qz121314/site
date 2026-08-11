export type PublicCta = {
  label: string;
  mode: 'customer_service' | 'link';
  path: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function loadPublicCta(
  productId: string,
  signal?: AbortSignal,
): Promise<PublicCta | null> {
  const response = await fetch(
    `/api/public/storefront/cta/${encodeURIComponent(productId)}`,
    {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      ...(signal ? { signal } : {}),
    },
  );
  if (!response.ok) throw new Error('CTA_UNAVAILABLE');

  const value = (await response.json()) as unknown;
  if (!isRecord(value)) throw new Error('CTA_INVALID');
  if (value.available === false) return null;
  if (
    value.available !== true ||
    typeof value.label !== 'string' ||
    !value.label.trim() ||
    (value.mode !== 'customer_service' && value.mode !== 'link') ||
    typeof value.path !== 'string' ||
    !value.path.startsWith('/')
  ) {
    throw new Error('CTA_INVALID');
  }

  return {
    label: value.label.trim(),
    mode: value.mode,
    path: value.path,
  };
}
