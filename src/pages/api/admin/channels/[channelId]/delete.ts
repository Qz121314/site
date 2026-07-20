import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";

export const prerender = false;

type GuardRow = {
  channel_exists: number;
  is_default: number;
  categories: number;
  products: number;
  ad_pools: number;
  conversion_groups: number;
};

function redirect(request: Request, params: Record<string, string>): Response {
  const url = new URL("/admin/channels", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request, params }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const channelId = params.channelId ?? "";
  if (!channelId) return new Response("Not Found", { status: 404 });

  try {
    const guard = await env.DB.prepare(
      `SELECT
        EXISTS(SELECT 1 FROM channels WHERE id = ?1) AS channel_exists,
        EXISTS(SELECT 1 FROM site_settings WHERE id = 1 AND default_channel_id = ?1) AS is_default,
        (SELECT COUNT(*) FROM categories WHERE channel_id = ?1) AS categories,
        (SELECT COUNT(*) FROM products WHERE channel_id = ?1) AS products,
        (SELECT COUNT(*) FROM ad_pools WHERE channel_id = ?1) AS ad_pools,
        (SELECT COUNT(*) FROM conversion_groups WHERE channel_id = ?1) AS conversion_groups`,
    ).bind(channelId).first<GuardRow>();

    if (!guard?.channel_exists) return redirect(request, { error: "not-found" });
    if (guard.is_default) return redirect(request, { error: "default" });
    if (guard.categories || guard.products || guard.ad_pools || guard.conversion_groups) {
      return redirect(request, { error: "in-use" });
    }

    await env.DB.prepare("DELETE FROM channels WHERE id = ?1").bind(channelId).run();
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_channel_delete_failed", channelId, error: String(error) }));
    return redirect(request, { error: "database" });
  }

  return redirect(request, { saved: "deleted" });
};
