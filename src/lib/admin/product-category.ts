import { env } from "cloudflare:workers";
import type { ProductStatus } from "@/lib/admin/product-form";
import { uniqueCategorySlug } from "@/lib/admin/automatic-slug";

export type ResolvedProductCategory = {
  id: string | null;
  created: boolean;
};

type CategoryRow = {
  id: string;
  status: string;
  image_asset_id: string | null;
};

function normalizeCategoryName(value: string): string {
  return value.trim().replace(/\s+/gu, " ").slice(0, 80);
}

export async function resolveProductCategory(input: {
  channelId: string;
  categoryId: string | null;
  categoryName: string;
  productStatus: ProductStatus;
  coverAssetId: string | null;
}): Promise<ResolvedProductCategory> {
  const categoryName = normalizeCategoryName(input.categoryName);

  if (!categoryName) {
    if (!input.categoryId) return { id: null, created: false };

    const existing = await env.DB.prepare(
      "SELECT id, status, image_asset_id FROM categories WHERE id = ?1 AND channel_id = ?2",
    ).bind(input.categoryId, input.channelId).first<CategoryRow>();
    if (!existing) return { id: input.categoryId, created: false };

    const shouldPublish = input.productStatus === "published" && existing.status !== "published";
    const shouldSetImage = Boolean(input.coverAssetId && !existing.image_asset_id);
    if (shouldPublish || shouldSetImage) {
      await env.DB.prepare(
        `UPDATE categories
         SET status = CASE WHEN ?3 = 1 THEN 'published' ELSE status END,
             image_asset_id = CASE WHEN image_asset_id IS NULL THEN ?4 ELSE image_asset_id END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?1 AND channel_id = ?2`,
      ).bind(existing.id, input.channelId, shouldPublish ? 1 : 0, input.coverAssetId).run();
    }
    return { id: existing.id, created: false };
  }

  const existing = await env.DB.prepare(
    `SELECT id, status, image_asset_id
     FROM categories
     WHERE channel_id = ?1 AND name = ?2 COLLATE NOCASE
     ORDER BY created_at ASC
     LIMIT 1`,
  ).bind(input.channelId, categoryName).first<CategoryRow>();

  if (existing) {
    const shouldPublish = input.productStatus === "published" && existing.status !== "published";
    const shouldSetImage = Boolean(input.coverAssetId && !existing.image_asset_id);
    if (shouldPublish || shouldSetImage) {
      await env.DB.prepare(
        `UPDATE categories
         SET status = CASE WHEN ?3 = 1 THEN 'published' ELSE status END,
             image_asset_id = CASE WHEN image_asset_id IS NULL THEN ?4 ELSE image_asset_id END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?1 AND channel_id = ?2`,
      ).bind(existing.id, input.channelId, shouldPublish ? 1 : 0, input.coverAssetId).run();
    }
    return { id: existing.id, created: false };
  }

  const id = crypto.randomUUID();
  const slug = await uniqueCategorySlug(input.channelId, categoryName);
  const status = input.productStatus === "published" ? "published" : "draft";

  await env.DB.prepare(
    `INSERT INTO categories (
       id, channel_id, name, slug, image_asset_id, sort_order, status
     )
     SELECT ?1, ?2, ?3, ?4, ?5, COALESCE(MAX(sort_order), 0) + 10, ?6
     FROM categories
     WHERE channel_id = ?2`,
  ).bind(id, input.channelId, categoryName, slug, input.coverAssetId, status).run();

  return { id, created: true };
}

export async function removeEmptyGeneratedCategory(categoryId: string | null): Promise<void> {
  if (!categoryId) return;
  await env.DB.prepare(
    `DELETE FROM categories
     WHERE id = ?1
       AND NOT EXISTS (SELECT 1 FROM products WHERE category_id = ?1)`,
  ).bind(categoryId).run();
}
