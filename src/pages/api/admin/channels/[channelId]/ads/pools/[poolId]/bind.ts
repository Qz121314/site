import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import { adPoolIntegrityErrorCode } from "@/lib/admin/ad-form";

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
    const pool = await env.DB.prepare(
      `SELECT
         pool.id,
         pool.status,
         EXISTS(
           SELECT 1
           FROM advertisements advertisement
           WHERE advertisement.pool_id = pool.id
             AND advertisement.status = 'enabled'
         ) AS enabled_advertisements
       FROM ad_pools pool
       WHERE pool.id = ?1 AND pool.channel_id = ?2`,
    ).bind(poolId, channelId).first<{ id: string; status: string; enabled_advertisements: number }>();
    if (!pool) return redirect(request, channelId, { error: "not-found" });
    if (pool.status !== "enabled" || !Boolean(pool.enabled_advertisements)) {
      return redirect(request, channelId, { error: "unavailable", pool: poolId });
    }

    const result = await env.DB.prepare(
      `UPDATE channels
       SET hero_ad_pool_id = ?2, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1`,
    ).bind(channelId, poolId).run();
    if (!result.meta.changes) return redirect(request, channelId, { error: "not-found" });

    return redirect(request, channelId, { saved: "bound", pool: poolId });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_ad_pool_bind_failed", channelId, poolId, error: String(error) }));
    return redirect(request, channelId, { error: adPoolIntegrityErrorCode(error) ?? "database", pool: poolId });
  }
};
