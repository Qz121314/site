import { env } from "cloudflare:workers";
import { uniqueCategorySlug } from "@/lib/admin/automatic-slug";

export type ResolvedProductCategory = {
  id: string | null;
  created: boolean;
};

type CategoryRow = { id: string };

function normalizeCategoryName(value: string): string {
  return value.trim().replace(/\s+/gu, " ").slice(0, 80);
}

export async function resolveProductCategory(input: {
  channelId: string;
  categoryName: string;
}): Promise<ResolvedProductCategory> {
  const categoryName = normalizeCategoryName(input.categoryName);

  if (!categoryName) {
    return { id: null, created: false };
  }

  const existing = await env.DB.prepare(
    `SELECT id
     FROM categories
     WHERE channel_id = ?1 AND name = ?2 COLLATE NOCASE
     ORDER BY created_at ASC
     LIMIT 1`,
  ).bind(input.channelId, categoryName).first<CategoryRow>();

  if (existing) {
    return { id: existing.id, created: false };
  }

  const id = crypto.randomUUID();
  const slug = await uniqueCategorySlug(input.channelId, categoryName);
  await env.DB.prepare(
    `INSERT INTO categories (
       id, channel_id, name, slug, sort_order, status
     )
     SELECT ?1, ?2, ?3, ?4, COALESCE(MAX(sort_order), 0) + 10, ?5
     FROM categories
     WHERE channel_id = ?2`,
  ).bind(id, input.channelId, categoryName, slug, "draft").run();

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
