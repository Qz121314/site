import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";

export const prerender = false;

function redirect(request: Request, channelId: string, params: Record<string, string>): Response {
  const url = new URL(`/admin/channels/${encodeURIComponent(channelId)}/ads`, request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request, params }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const channelId = params.channelId ?? "";
  if (!channelId) return new Response("Not Found", { status: 404 });

  try {
    const result = await env.DB.prepare(
      `UPDATE channels
       SET hero_ad_pool_id = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1`,
    ).bind(channelId).run();
    if (!result.meta.changes) return redirect(request, channelId, { error: "not-found" });

    return redirect(request, channelId, { saved: "unbound" });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_ad_pool_unbind_failed", channelId, error: String(error) }));
    return redirect(request, channelId, { error: "database" });
  }
};
