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
  if (!parsed.ok) return redirect(request, channelId, { error: parsed.code, pool: poolId, ad: adId });

  try {
    if (
      parsed.creativeType === "uploaded_image"
      && (!parsed.imageAssetId || !(await imageAssetsExist([parsed.imageAssetId])))
    ) {
      return redirect(request, channelId, { error: "image", pool: poolId, ad: adId });
    }

    const result = await env.DB.prepare(
      `UPDATE advertisements
       SET name = ?4,
           display_type = ?5,
           creative_type = ?6,
           image_asset_id = ?7,
           media_url = ?8,
           embed_code = ?9,
           target_url = ?10,
           declared_width = ?11,
           declared_height = ?12,
           open_mode = ?13,
           status = ?14,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1
         AND pool_id = ?2
         AND EXISTS (
           SELECT 1 FROM ad_pools pool WHERE pool.id = ?2 AND pool.channel_id = ?3
         )`,
    ).bind(
      adId,
      poolId,
      channelId,
      parsed.name,
      parsed.displayType,
      parsed.creativeType,
      parsed.imageAssetId,
      parsed.mediaUrl,
      parsed.embedCode,
      parsed.targetUrl,
      parsed.declaredWidth,
      parsed.declaredHeight,
      parsed.openMode,
      parsed.status,
    ).run();

    if (!result.meta.changes) return redirect(request, channelId, { error: "not-found", pool: poolId });
    return redirect(request, channelId, { saved: "ad-updated", pool: poolId, ad: adId });
  } catch (error) {
    console.error(JSON.stringify({
      event: "admin_ad_update_failed",
      channelId,
      poolId,
      adId,
      displayType: parsed.displayType,
      creativeType: parsed.creativeType,
      error: String(error),
    }));
    return redirect(request, channelId, { error: "database", pool: poolId, ad: adId });
  }
};
