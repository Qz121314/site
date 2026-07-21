import { env } from "cloudflare:workers";
import { renderProductBody } from "@/lib/admin/product-body";

export { renderProductBody } from "@/lib/admin/product-body";

export const PRODUCT_STATUSES = ["draft", "published", "disabled"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export type ProductContentValue = {
  title: string;
  slug: string;
  categoryId: string | null;
  conversionGroupId: string | null;
  coverAssetId: string | null;
  tags: string[];
  tagsJson: string;
  bodySource: string;
  bodyHtml: string;
  ctaLabel: string;
};

export type ProductManagementValue = {
  featured: boolean;
  sortOrder: number;
  status: ProductStatus;
};

export type ProductContentErrorCode =
  | "title"
  | "slug"
  | "category"
  | "conversion"
  | "tags"
  | "body"
  | "cta";

export type ProductManagementErrorCode = "sort" | "status";

export type ProductRelationErrorCode =
  | "category"
  | "category-unavailable"
  | "conversion"
  | "conversion-required"
  | "conversion-unavailable";

export type ProductPublishErrorCode = ProductRelationErrorCode | "image" | "not-found";

export type ProductContentResult =
  | { ok: true; value: ProductContentValue }
  | { ok: false; code: ProductContentErrorCode };

export type ProductManagementResult =
  | { ok: true; value: ProductManagementValue }
  | { ok: false; code: ProductManagementErrorCode };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function readText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readBodySource(form: FormData): string {
  const value = form.get("bodySource");
  return typeof value === "string" ? value.replace(/\r\n?/gu, "\n") : "";
}

function readOptionalId(form: FormData, name: string): string | null | undefined {
  const value = readText(form, name);
  if (!value) return null;
  return ID_PATTERN.test(value) ? value : undefined;
}

function parseTags(raw: string): string[] | null {
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const item of raw.split(/[,\n]/gu)) {
    const tag = item.trim();
    if (!tag) continue;
    if (tag.length > 40) return null;

    const key = tag.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }

  return tags.length <= 20 ? tags : null;
}

export function parseProductContentForm(form: FormData): ProductContentResult {
  const title = readText(form, "title");
  const slug = readText(form, "slug").toLowerCase();
  const categoryId = readOptionalId(form, "categoryId");
  const conversionGroupId = readOptionalId(form, "conversionGroupId");
  const tags = parseTags(readText(form, "tags"));
  const bodySource = readBodySource(form);
  const ctaLabel = readText(form, "ctaLabel");

  if (!title || title.length > 160) return { ok: false, code: "title" };
  if (!slug || slug.length > 96 || !SLUG_PATTERN.test(slug)) return { ok: false, code: "slug" };
  if (categoryId === undefined) return { ok: false, code: "category" };
  if (conversionGroupId === undefined) return { ok: false, code: "conversion" };
  if (!tags) return { ok: false, code: "tags" };
  if (bodySource.length > 30000) return { ok: false, code: "body" };
  if (!ctaLabel || ctaLabel.length > 80) return { ok: false, code: "cta" };

  return {
    ok: true,
    value: {
      title,
      slug,
      categoryId,
      conversionGroupId,
      coverAssetId: null,
      tags,
      tagsJson: JSON.stringify(tags),
      bodySource,
      bodyHtml: renderProductBody(bodySource),
      ctaLabel,
    },
  };
}

export function parseProductManagementForm(form: FormData): ProductManagementResult {
  const sortOrder = Number(readText(form, "sortOrder") || "0");
  const statusText = readText(form, "status");

  if (!Number.isSafeInteger(sortOrder) || sortOrder < -999999 || sortOrder > 999999) {
    return { ok: false, code: "sort" };
  }
  if (!PRODUCT_STATUSES.includes(statusText as ProductStatus)) {
    return { ok: false, code: "status" };
  }

  return {
    ok: true,
    value: {
      featured: form.get("featured") === "1",
      sortOrder,
      status: statusText as ProductStatus,
    },
  };
}

export async function validateProductRelations(
  channelId: string,
  categoryId: string | null,
  conversionGroupId: string | null,
  status: ProductStatus,
): Promise<ProductRelationErrorCode | null> {
  if (categoryId) {
    const category = await env.DB.prepare(
      "SELECT status FROM categories WHERE id = ?1 AND channel_id = ?2",
    ).bind(categoryId, channelId).first<{ status: string }>();

    if (!category) return "category";
    if (status === "published" && category.status !== "published") return "category-unavailable";
  }

  if (!conversionGroupId) {
    return status === "published" ? "conversion-required" : null;
  }

  const group = await env.DB.prepare(
    `SELECT g.status, COUNT(r.id) AS enabled_resources
     FROM conversion_groups g
     LEFT JOIN conversion_resources r ON r.group_id = g.id AND r.status = 'enabled'
     WHERE g.id = ?1 AND g.channel_id = ?2
     GROUP BY g.id, g.status`,
  ).bind(conversionGroupId, channelId).first<{ status: string; enabled_resources: number }>();

  if (!group) return "conversion";
  if (status === "published" && (group.status !== "enabled" || Number(group.enabled_resources ?? 0) < 1)) {
    return "conversion-unavailable";
  }

  return null;
}

export async function validateProductPublishing(
  channelId: string,
  productId: string,
): Promise<ProductPublishErrorCode | null> {
  const product = await env.DB.prepare(
    `SELECT
       p.category_id,
       p.conversion_group_id,
       EXISTS(SELECT 1 FROM product_images pi WHERE pi.product_id = p.id) AS has_image
     FROM products p
     WHERE p.id = ?1 AND p.channel_id = ?2`,
  ).bind(productId, channelId).first<{
    category_id: string | null;
    conversion_group_id: string | null;
    has_image: number;
  }>();

  if (!product) return "not-found";
  if (Number(product.has_image ?? 0) !== 1) return "image";
  return validateProductRelations(
    channelId,
    product.category_id,
    product.conversion_group_id,
    "published",
  );
}

export function isDuplicateProductSlugError(error: unknown): boolean {
  const message = String(error);
  return (
    message.includes("UNIQUE constraint failed: products.channel_id, products.slug") ||
    message.includes("products.channel_id, products.slug")
  );
}
