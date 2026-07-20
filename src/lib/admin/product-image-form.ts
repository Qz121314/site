export type ProductImageFormResult =
  | { ok: true; imageAssetId: string; sortOrder: number }
  | { ok: false; code: "image" | "sort" };

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function readText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function parseProductImageForm(form: FormData): ProductImageFormResult {
  const imageAssetId = readText(form, "imageAssetId");
  const sortOrder = Number(readText(form, "sortOrder") || "0");

  if (!ID_PATTERN.test(imageAssetId)) return { ok: false, code: "image" };
  if (!Number.isSafeInteger(sortOrder) || sortOrder < -999999 || sortOrder > 999999) {
    return { ok: false, code: "sort" };
  }

  return { ok: true, imageAssetId, sortOrder };
}

export function parseProductImageSort(form: FormData): number | null {
  const sortOrder = Number(readText(form, "sortOrder") || "0");
  return Number.isSafeInteger(sortOrder) && sortOrder >= -999999 && sortOrder <= 999999
    ? sortOrder
    : null;
}
