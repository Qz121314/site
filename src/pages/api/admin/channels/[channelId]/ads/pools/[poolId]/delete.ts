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
  const poolId = params.poolId ?? "";
  if (!channelId || !poolId) return new Response("Not Found", { status: 404 });

  try {
    const bound = await env.DB.prepare(
      "SELECT id FROM channels WHERE id = ?1 AND hero_ad_pool_id = ?2",
    ).bind(channelId, poolId).first<{ id: string }>();
    if (bound) return redirect(request, channelId, { error: "in-use" });

    const result = await env.DB.prepare(
      "DELETE FROM ad_pools WHERE id = ?1 AND channel_id = ?2",
    ).bind(poolId, channelId).run();
    if (!result.meta.changes) return redirect(request, channelId, { error: "not-found" });

    return redirect(request, channelId, { saved: "pool-deleted" });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_ad_pool_delete_failed", channelId, poolId, error: String(error) }));
    return redirect(request, channelId, { error: "database" });
  }
};
