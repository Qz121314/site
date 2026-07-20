const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type ProductEntryExtraResult =
  | {
      ok: true;
      categoryName: string;
      galleryAssetIds: string[];
      submitAction: "save" | "continue";
    }
  | { ok: false; code: "category-name" | "gallery" };

export function parseProductEntryExtras(form: FormData): ProductEntryExtraResult {
  const rawCategoryName = form.get("categoryName");
  const categoryName = typeof rawCategoryName === "string"
    ? rawCategoryName.trim().replace(/\s+/gu, " ")
    : "";

  if (categoryName.length > 80) return { ok: false, code: "category-name" };

  const galleryAssetIds = [
    ...new Set(
      form
        .getAll("galleryAssetIds")
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];

  if (galleryAssetIds.length > 30 || galleryAssetIds.some((id) => !ID_PATTERN.test(id))) {
    return { ok: false, code: "gallery" };
  }

  return {
    ok: true,
    categoryName,
    galleryAssetIds,
    submitAction: form.get("submitAction") === "continue" ? "continue" : "save",
  };
}
