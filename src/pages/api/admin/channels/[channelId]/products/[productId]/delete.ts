import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";

export const prerender = false;

function redirect(request: Request, channelId: string, params: Record<string, string>): Response {
  const url = new URL(`/admin/channels/${encodeURIComponent(channelId)}/products`, request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request, params }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const channelId = params.channelId ?? "";
  const productId = params.productId ?? "";
  if (!channelId || !productId) return new Response("Not Found", { status: 404 });

  try {
    const result = await env.DB.prepare(
      "DELETE FROM products WHERE id = ?1 AND channel_id = ?2",
    ).bind(productId, channelId).run();
    if (!result.meta.changes) return redirect(request, channelId, { error: "not-found" });

    return redirect(request, channelId, { saved: "deleted" });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_product_delete_failed", channelId, productId, error: String(error) }));
    return redirect(request, channelId, { error: "database" });
  }
};
