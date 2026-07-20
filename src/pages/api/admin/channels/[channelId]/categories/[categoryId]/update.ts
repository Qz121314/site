import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import {
  categoryFiltersBelongToChannel,
  isDuplicateCategorySlugError,
  parseCategoryForm,
} from "@/lib/admin/category-form";
import { imageAssetsExist } from "@/lib/db/image-options";

export const prerender = false;

function redirect(request: Request, channelId: string, params: Record<string, string>): Response {
  const url = new URL(`/admin/channels/${encodeURIComponent(channelId)}/categories`, request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request, params }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const channelId = params.channelId ?? "";
  const categoryId = params.categoryId ?? "";
  if (!channelId || !categoryId) return new Response("Not Found", { status: 404 });

  const parsed = parseCategoryForm(await request.formData());
  if (!parsed.ok) return redirect(request, channelId, { error: parsed.code });

  const { name, slug, imageAssetId, sortOrder, status, filterIds } = parsed.value;

  try {
    const category = await env.DB.prepare(
      "SELECT id FROM categories WHERE id = ?1 AND channel_id = ?2",
    ).bind(categoryId, channelId).first<{ id: string }>();
    if (!category) return redirect(request, channelId, { error: "not-found" });

    if (!(await categoryFiltersBelongToChannel(channelId, filterIds))) {
      return redirect(request, channelId, { error: "filters" });
    }
    if (!(await imageAssetsExist([imageAssetId ?? ""]))) {
      return redirect(request, channelId, { error: "image" });
    }

    const statements = [
      env.DB.prepare(
        `UPDATE categories
         SET name = ?3,
             slug = ?4,
             image_asset_id = ?5,
             sort_order = ?6,
             status = ?7,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?1 AND channel_id = ?2`,
      ).bind(categoryId, channelId, name, slug, imageAssetId, sortOrder, status),
      env.DB.prepare("DELETE FROM category_filter_relations WHERE category_id = ?1").bind(categoryId),
      ...filterIds.map((filterId) =>
        env.DB.prepare(
          `INSERT INTO category_filter_relations (category_id, filter_id)
           VALUES (?1, ?2)`,
        ).bind(categoryId, filterId),
      ),
    ];

    await env.DB.batch(statements);
    return redirect(request, channelId, { saved: "updated", category: categoryId });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_category_update_failed", channelId, categoryId, slug, error: String(error) }));
    return redirect(request, channelId, {
      error: isDuplicateCategorySlugError(error) ? "duplicate" : "database",
    });
  }
};
