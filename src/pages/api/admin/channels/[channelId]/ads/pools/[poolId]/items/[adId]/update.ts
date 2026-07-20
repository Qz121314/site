import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import { parseAdvertisementForm } from "@/lib/admin/ad-form";
import { imageAssetsExist } from "@/lib/db/image-options";

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

  const parsed = parseAdvertisementForm(await request.formData());
  if (!parsed.ok) return redirect(request, channelId, { error: parsed.code, pool: poolId });

  try {
    if (!(await imageAssetsExist([parsed.imageAssetId]))) {
      return redirect(request, channelId, { error: "image", pool: poolId });
    }

    const result = await env.DB.prepare(
      `UPDATE advertisements
       SET image_asset_id = ?4,
           target_url = ?5,
           open_mode = ?6,
           sort_order = ?7,
           status = ?8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1
         AND pool_id = ?2
         AND EXISTS (
           SELECT 1 FROM ad_pools p WHERE p.id = ?2 AND p.channel_id = ?3
         )`,
    ).bind(
      adId,
      poolId,
      channelId,
      parsed.imageAssetId,
      parsed.targetUrl,
      parsed.openMode,
      parsed.sortOrder,
      parsed.status,
    ).run();

    if (!result.meta.changes) return redirect(request, channelId, { error: "not-found" });
    return redirect(request, channelId, { saved: "ad-updated", pool: poolId, ad: adId });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_ad_update_failed", channelId, poolId, adId, error: String(error) }));
    return redirect(request, channelId, { error: "database", pool: poolId });
  }
};
