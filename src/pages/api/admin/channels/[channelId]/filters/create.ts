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
  if (!channelId) return new Response("Not Found", { status: 404 });

  const parsed = parseFilterForm(await request.formData());
  if (!parsed.ok) return redirect(request, channelId, { error: parsed.code });

  const { name, sortOrder, status } = parsed.value;
  const id = crypto.randomUUID();

  try {
    const channel = await env.DB.prepare("SELECT id FROM channels WHERE id = ?1")
      .bind(channelId)
      .first<{ id: string }>();
    if (!channel) return redirect(request, channelId, { error: "not-found" });

    const slug = await uniqueFilterSlug(channelId, name);
    await env.DB.prepare(
      `INSERT INTO category_filters (id, channel_id, name, slug, sort_order, status)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    ).bind(id, channelId, name, slug, sortOrder, status).run();
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_category_filter_create_failed", channelId, name, error: String(error) }));
    return redirect(request, channelId, { error: "database" });
  }

  return redirect(request, channelId, { saved: "created" });
};
