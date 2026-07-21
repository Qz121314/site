import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { adminReturnUrl, redirectAdmin } from "@/lib/admin/admin-return";
import { isSameOriginPost } from "@/lib/auth/session";

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const channelId = params.channelId ?? "";
  const productId = params.productId ?? "";
  if (!channelId || !productId) return new Response("Not Found", { status: 404 });

  const form = await request.formData();
  const fallbackPath = `/admin/channels/${encodeURIComponent(channelId)}/products`;
  const returnUrl = adminReturnUrl(request, form, fallbackPath);

  try {
    const result = await env.DB.prepare(
      "DELETE FROM products WHERE id = ?1 AND channel_id = ?2",
    ).bind(productId, channelId).run();
    if (!result.meta.changes) return redirectAdmin(returnUrl, { error: "not-found", saved: null });

    if (returnUrl.searchParams.get("edit") === productId) returnUrl.searchParams.delete("edit");
    return redirectAdmin(returnUrl, { saved: "deleted", error: null });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_product_delete_failed", channelId, productId, error: String(error) }));
    return redirectAdmin(returnUrl, { error: "database", saved: null });
  }
};
