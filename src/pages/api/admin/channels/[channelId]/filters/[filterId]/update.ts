import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import { parseFilterForm } from "@/lib/admin/filter-form";
import { uniqueFilterSlug } from "@/lib/admin/automatic-slug";

export const prerender = false;

function redirect(request: Request, channelId: string, params: Record<string, string>): Response {
  const url = new URL(`/admin/channels/${encodeURIComponent(channelId)}/filters`, request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request, params }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const channelId = params.channelId ?? "";
  const filterId = params.filterId ?? "";
  if (!channelId || !filterId) return new Response("Not Found", { status: 404 });

  const parsed = parseFilterForm(await request.formData());
  if (!parsed.ok) return redirect(request, channelId, { error: parsed.code });

  const { name, sortOrder, status } = parsed.value;

  try {
    const slug = await uniqueFilterSlug(channelId, name, filterId);
    const result = await env.DB.prepare(
      `UPDATE category_filters
       SET name = ?3,
           slug = ?4,
           sort_order = ?5,
           status = ?6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1 AND channel_id = ?2`,
    ).bind(filterId, channelId, name, slug, sortOrder, status).run();

    if (result.meta.changes === 0) return redirect(request, channelId, { error: "not-found" });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_category_filter_update_failed", channelId, filterId, name, error: String(error) }));
    return redirect(request, channelId, { error: "database" });
  }

  return redirect(request, channelId, { saved: "updated" });
};
