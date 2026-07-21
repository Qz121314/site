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
  const adId = params.adId ?? "";
  if (!channelId || !poolId || !adId) return new Response("Not Found", { status: 404 });

  try {
    const result = await env.DB.prepare(
      `DELETE FROM advertisements
       WHERE id = ?1
         AND pool_id = ?2
         AND EXISTS (
           SELECT 1 FROM ad_pools p WHERE p.id = ?2 AND p.channel_id = ?3
         )`,
    ).bind(adId, poolId, channelId).run();

    if (!result.meta.changes) return redirect(request, channelId, { error: "not-found" });
    return redirect(request, channelId, { saved: "ad-deleted", pool: poolId });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_ad_delete_failed", channelId, poolId, adId, error: String(error) }));
    return redirect(request, channelId, { error: adPoolIntegrityErrorCode(error) ?? "database", pool: poolId });
  }
};
