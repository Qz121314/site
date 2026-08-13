import { getConversionGroup, type ConversionMode } from './conversion-pool';

export type RoutableProduct = {
  id: string;
  sectionId: string;
  title: string;
  conversionGroupId: string | null;
};

export type PublicCta = {
  label: string;
  mode: ConversionMode;
  path: string;
};

type RoutableProductRow = {
  id: string;
  section_id: string;
  title: string;
  conversion_group_id: string | null;
};

export async function getRoutableProduct(
  db: D1Database,
  productId: string,
): Promise<RoutableProduct | null> {
  const row = await db
    .prepare(
      `SELECT p.id, p.section_id, p.title, p.conversion_group_id
       FROM products p
       JOIN sections s ON s.id = p.section_id
       WHERE p.id = ?
         AND p.deleted_at IS NULL
         AND p.status = 'published'
         AND s.deleted_at IS NULL
         AND s.is_enabled = 1`,
    )
    .bind(productId)
    .first<RoutableProductRow>();

  return row
    ? {
        id: row.id,
        sectionId: row.section_id,
        title: row.title,
        conversionGroupId: row.conversion_group_id,
      }
    : null;
}

export async function resolvePublicCta(
  db: D1Database,
  productId: string,
): Promise<{ product: RoutableProduct | null; cta: PublicCta | null }> {
  const product = await getRoutableProduct(db, productId);
  if (!product?.conversionGroupId) return { product, cta: null };

  const group = await getConversionGroup(
    db,
    product.sectionId,
    product.conversionGroupId,
  );
  if (!group || group.deletedAt || !group.isEnabled || group.activeTargetCount < 1) {
    return { product, cta: null };
  }

  const path =
    group.mode === 'customer_service'
      ? `/messages/new/?${new URLSearchParams({
          productId: product.id,
          sectionId: product.sectionId,
        }).toString()}`
      : `/go/${encodeURIComponent(product.id)}`;

  return {
    product,
    cta: {
      label: group.buttonLabel,
      mode: group.mode,
      path,
    },
  };
}
