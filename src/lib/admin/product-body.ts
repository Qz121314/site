import { renderProductBody as renderLegacyProductBody } from "@/lib/admin/product-form";
import { normalizeProductBodyLists } from "@/lib/admin/product-body-normalize";

export function renderProductBody(source: string): string {
  return renderLegacyProductBody(normalizeProductBodyLists(source));
}
