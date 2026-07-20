import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import { isDuplicateChannelSlugError, parseChannelForm } from "@/lib/admin/channel-form";

export const prerender = false;

function redirect(request: Request, channelId: string, params: Record<string, string>): Response {
  const url = new URL(`/admin/channels/${encodeURIComponent(channelId)}`, request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request, params }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const channelId = params.channelId ?? "";
  if (!channelId) return new Response("Not Found", { status: 404 });

  const parsed = parseChannelForm(await request.formData());
  if (!parsed.ok) return redirect(request, channelId, { error: parsed.code });

  const { name, slug, icon, sortOrder, status } = parsed.value;

  try {
    const existing = await env.DB.prepare("SELECT id FROM channels WHERE id = ?1").bind(channelId).first<{ id: string }>();
    if (!existing) return new Response("Not Found", { status: 404 });

    await env.DB.prepare(
      `UPDATE channels
       SET name = ?2,
           slug = ?3,
           icon = ?4,
           sort_order = ?5,
           status = ?6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1`,
    ).bind(channelId, name, slug, icon, sortOrder, status).run();
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_channel_update_failed", channelId, slug, error: String(error) }));
    return redirect(request, channelId, { error: isDuplicateChannelSlugError(error) ? "duplicate" : "database" });
  }

  return redirect(request, channelId, { saved: "updated" });
};
