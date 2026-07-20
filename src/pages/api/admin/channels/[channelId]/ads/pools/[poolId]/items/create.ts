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
    if (!(await imageAssetsExist([parsed.imageAssetId]))) {
      return redirect(request, channelId, { error: "image", pool: poolId });
    }

    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO advertisements
         (id, pool_id, image_asset_id, target_url, open_mode, sort_order, status)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    ).bind(
      id,
      poolId,
      parsed.imageAssetId,
      parsed.targetUrl,
      parsed.openMode,
      parsed.sortOrder,
      parsed.status,
    ).run();

    return redirect(request, channelId, { saved: "ad-created", pool: poolId, ad: id });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_ad_create_failed", channelId, poolId, error: String(error) }));
    return redirect(request, channelId, { error: "database", pool: poolId });
  }
};
