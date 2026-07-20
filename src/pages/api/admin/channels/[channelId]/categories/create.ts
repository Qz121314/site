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
  if (!channelId) return new Response("Not Found", { status: 404 });

  const parsed = parseCategoryForm(await request.formData());
  if (!parsed.ok) return redirect(request, channelId, { error: parsed.code });

  const { name, slug, imageAssetId, sortOrder, status, filterIds } = parsed.value;
  const id = crypto.randomUUID();

  try {
    const channel = await env.DB.prepare("SELECT id FROM channels WHERE id = ?1")
      .bind(channelId)
      .first<{ id: string }>();
    if (!channel) return redirect(request, channelId, { error: "not-found" });

    if (!(await categoryFiltersBelongToChannel(channelId, filterIds))) {
      return redirect(request, channelId, { error: "filters" });
    }
    if (!(await imageAssetsExist([imageAssetId ?? ""]))) {
      return redirect(request, channelId, { error: "image" });
    }

    const statements = [
      env.DB.prepare(
        `INSERT INTO categories (id, channel_id, name, slug, image_asset_id, sort_order, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      ).bind(id, channelId, name, slug, imageAssetId, sortOrder, status),
      ...filterIds.map((filterId) =>
        env.DB.prepare(
          `INSERT INTO category_filter_relations (category_id, filter_id)
           VALUES (?1, ?2)`,
        ).bind(id, filterId),
      ),
    ];

    await env.DB.batch(statements);
    return redirect(request, channelId, { saved: "created", category: id });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_category_create_failed", channelId, slug, error: String(error) }));
    return redirect(request, channelId, {
      error: isDuplicateCategorySlugError(error) ? "duplicate" : "database",
    });
  }
};
