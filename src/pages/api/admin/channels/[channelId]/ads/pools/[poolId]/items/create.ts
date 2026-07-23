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
  if (!channelId || !poolId) return new Response("Not Found", { status: 404 });

  const parsed = parseAdvertisementForm(await request.formData());
  if (!parsed.ok) return redirect(request, channelId, { error: parsed.code, pool: poolId });

  try {
    const pool = await env.DB.prepare(
      "SELECT id FROM ad_pools WHERE id = ?1 AND channel_id = ?2",
    ).bind(poolId, channelId).first<{ id: string }>();
    if (!pool) return redirect(request, channelId, { error: "not-found" });
    if (
      parsed.creativeType === "uploaded_image"
      && (!parsed.imageAssetId || !(await imageAssetsExist([parsed.imageAssetId])))
    ) {
      return redirect(request, channelId, { error: "image", pool: poolId });
    }

    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO advertisements (
         id,
         pool_id,
         name,
         display_type,
         creative_type,
         image_asset_id,
         media_url,
         embed_code,
         target_url,
         declared_width,
         declared_height,
         open_mode,
         status
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
    ).bind(
      id,
      poolId,
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

    return redirect(request, channelId, { saved: "ad-created", pool: poolId, ad: id });
  } catch (error) {
    console.error(JSON.stringify({
      event: "admin_ad_create_failed",
      channelId,
      poolId,
      displayType: parsed.displayType,
      creativeType: parsed.creativeType,
      error: String(error),
    }));
    return redirect(request, channelId, { error: "database", pool: poolId });
  }
};
