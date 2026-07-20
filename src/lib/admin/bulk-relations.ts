export const MAX_CATEGORY_FILTERS = 50;
export const MAX_PRODUCT_IMAGES = 30;
export const D1_MAX_BOUND_PARAMETERS = 100;

export type PreparedSql = {
  sql: string;
  bindings: Array<string | number | null>;
};

function placeholders(rowCount: number, columnCount: number): string {
  let parameter = 1;
  return Array.from({ length: rowCount }, () => {
    const row = Array.from({ length: columnCount }, () => `?${parameter++}`);
    return `(${row.join(", ")})`;
  }).join(", ");
}

function assertParameterLimit(bindings: readonly unknown[]): void {
  if (bindings.length > D1_MAX_BOUND_PARAMETERS) {
    throw new RangeError(`D1 bound parameter limit exceeded: ${bindings.length}`);
  }
}

export function productImagesInsert(
  productId: string,
  imageAssetIds: readonly string[],
): PreparedSql | null {
  if (imageAssetIds.length === 0) return null;
  if (imageAssetIds.length > MAX_PRODUCT_IMAGES) throw new RangeError("Too many product images");

  const bindings = imageAssetIds.flatMap((imageAssetId, index) => [
    productId,
    imageAssetId,
    index * 10,
  ]);
  assertParameterLimit(bindings);

  return {
    sql: `INSERT INTO product_images (product_id, image_asset_id, sort_order) VALUES ${placeholders(imageAssetIds.length, 3)}`,
    bindings,
  };
}

export function categoryFiltersInsert(
  categoryId: string,
  filterIds: readonly string[],
): PreparedSql | null {
  if (filterIds.length === 0) return null;
  if (filterIds.length > MAX_CATEGORY_FILTERS) throw new RangeError("Too many category filters");

  const bindings = filterIds.flatMap((filterId) => [categoryId, filterId]);
  assertParameterLimit(bindings);

  return {
    sql: `INSERT INTO category_filter_relations (category_id, filter_id) VALUES ${placeholders(filterIds.length, 2)}`,
    bindings,
  };
}
