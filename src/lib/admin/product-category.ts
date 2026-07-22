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
};

function normalizeCategoryName(value: string): string {
  return value.trim().replace(/\s+/gu, " ").slice(0, 80);
}

export async function resolveProductCategory(input: {
  channelId: string;
  categoryId: string | null;
  categoryName: string;
  productStatus: ProductStatus;
}): Promise<ResolvedProductCategory> {
  const categoryName = normalizeCategoryName(input.categoryName);

  if (!categoryName) {
    if (!input.categoryId) return { id: null, created: false };

    const existing = await env.DB.prepare(
      "SELECT id, status FROM categories WHERE id = ?1 AND channel_id = ?2",
    ).bind(input.categoryId, input.channelId).first<CategoryRow>();
    if (!existing) return { id: input.categoryId, created: false };

    const shouldPublish = input.productStatus === "published" && existing.status !== "published";
    if (shouldPublish) {
      await env.DB.prepare(
        `UPDATE categories
         SET status = 'published',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?1 AND channel_id = ?2`,
      ).bind(existing.id, input.channelId).run();
    }
    return { id: existing.id, created: false };
  }

  const existing = await env.DB.prepare(
    `SELECT id, status
     FROM categories
     WHERE channel_id = ?1 AND name = ?2 COLLATE NOCASE
     ORDER BY created_at ASC
     LIMIT 1`,
  ).bind(input.channelId, categoryName).first<CategoryRow>();

  if (existing) {
    const shouldPublish = input.productStatus === "published" && existing.status !== "published";
    if (shouldPublish) {
      await env.DB.prepare(
        `UPDATE categories
         SET status = 'published',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?1 AND channel_id = ?2`,
      ).bind(existing.id, input.channelId).run();
    }
    return { id: existing.id, created: false };
  }

  const id = crypto.randomUUID();
  const slug = await uniqueCategorySlug(input.channelId, categoryName);
  const status = input.productStatus === "published" ? "published" : "draft";

  await env.DB.prepare(
    `INSERT INTO categories (
       id, channel_id, name, slug, sort_order, status
     )
     SELECT ?1, ?2, ?3, ?4, COALESCE(MAX(sort_order), 0) + 10, ?5
     FROM categories
     WHERE channel_id = ?2`,
  ).bind(id, input.channelId, categoryName, slug, status).run();

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
