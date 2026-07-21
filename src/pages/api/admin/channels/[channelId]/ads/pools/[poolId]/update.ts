import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import { adPoolIntegrityErrorCode, isDuplicateAdPoolNameError, parseAdPoolForm } from "@/lib/admin/ad-form";

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

  const parsed = parseAdPoolForm(await request.formData());
  if (!parsed.ok) return redirect(request, channelId, { error: parsed.code });

  try {
    const result = await env.DB.prepare(
      `UPDATE ad_pools
       SET name = ?3,
           status = ?4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1 AND channel_id = ?2`,
    ).bind(poolId, channelId, parsed.name, parsed.status).run();

    if (!result.meta.changes) return redirect(request, channelId, { error: "not-found" });
    return redirect(request, channelId, { saved: "pool-updated", pool: poolId });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_ad_pool_update_failed", channelId, poolId, name: parsed.name, error: String(error) }));
    return redirect(request, channelId, {
      error: isDuplicateAdPoolNameError(error)
        ? "duplicate"
        : adPoolIntegrityErrorCode(error) ?? "database",
    });
  }
};
