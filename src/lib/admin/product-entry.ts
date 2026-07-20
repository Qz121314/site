import {
  MAX_CATEGORY_FILTERS,
  MAX_PRODUCT_IMAGES,
} from "@/lib/admin/bulk-relations";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type ProductEntryExtraResult =
  | {
      ok: true;
      categoryName: string;
      filterIds: string[];
      galleryAssetIds: string[];
      submitAction: "save" | "continue";
    }
  | { ok: false; code: "category-name" | "filters" | "gallery" };

function readIds(form: FormData, name: string, maximum: number): string[] | null {
  const values = [
    ...new Set(
      form
        .getAll(name)
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];

  if (values.length > maximum || values.some((id) => !ID_PATTERN.test(id))) return null;
  return values;
}

export function parseProductEntryExtras(form: FormData): ProductEntryExtraResult {
  const rawCategoryName = form.get("categoryName");
  const categoryName = typeof rawCategoryName === "string"
    ? rawCategoryName.trim().replace(/\s+/gu, " ")
    : "";

  if (categoryName.length > 80) return { ok: false, code: "category-name" };

  const filterIds = readIds(form, "filterIds", MAX_CATEGORY_FILTERS);
  if (!filterIds) return { ok: false, code: "filters" };

  const galleryAssetIds = readIds(form, "galleryAssetIds", MAX_PRODUCT_IMAGES);
  if (!galleryAssetIds) return { ok: false, code: "gallery" };

  return {
    ok: true,
    categoryName,
    filterIds,
    galleryAssetIds,
    submitAction: form.get("submitAction") === "continue" ? "continue" : "save",
  };
}
