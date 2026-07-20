import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import { parseProductImageSort } from "@/lib/admin/product-image-form";

export const prerender = false;

function redirect(request: Request, channelId: string, productId: string, params: Record<string, string>): Response {
  const url = new URL(
    `/admin/channels/${encodeURIComponent(channelId)}/products/${encodeURIComponent(productId)}`,
    request.url,
  );
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request, params }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const channelId = params.channelId ?? "";
  const productId = params.productId ?? "";
  const imageId = params.imageId ?? "";
  if (!channelId || !productId || !imageId) return new Response("Not Found", { status: 404 });

  const sortOrder = parseProductImageSort(await request.formData());
  if (sortOrder === null) return redirect(request, channelId, productId, { error: "sort" });

  try {
    const result = await env.DB.prepare(
      `UPDATE product_images
       SET sort_order = ?1
       WHERE product_id = ?2
         AND image_asset_id = ?3
         AND EXISTS (
           SELECT 1 FROM products p WHERE p.id = ?2 AND p.channel_id = ?4
         )`,
    ).bind(sortOrder, productId, imageId, channelId).run();

    if (!result.meta.changes) return redirect(request, channelId, productId, { error: "not-found" });
    return redirect(request, channelId, productId, { saved: "image-updated" });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_product_image_update_failed", channelId, productId, imageId, error: String(error) }));
    return redirect(request, channelId, productId, { error: "database" });
  }
};
