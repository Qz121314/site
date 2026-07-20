import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import { parseProductImageForm } from "@/lib/admin/product-image-form";
import { imageAssetsExist } from "@/lib/db/image-options";

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
  if (!channelId || !productId) return new Response("Not Found", { status: 404 });

  const parsed = parseProductImageForm(await request.formData());
  if (!parsed.ok) return redirect(request, channelId, productId, { error: parsed.code });

  try {
    const product = await env.DB.prepare(
      "SELECT id FROM products WHERE id = ?1 AND channel_id = ?2",
    ).bind(productId, channelId).first<{ id: string }>();
    if (!product) return redirect(request, channelId, productId, { error: "not-found" });
    if (!(await imageAssetsExist([parsed.imageAssetId]))) {
      return redirect(request, channelId, productId, { error: "image" });
    }

    await env.DB.prepare(
      `INSERT INTO product_images (product_id, image_asset_id, sort_order)
       VALUES (?1, ?2, ?3)`,
    ).bind(productId, parsed.imageAssetId, parsed.sortOrder).run();

    return redirect(request, channelId, productId, { saved: "image-added" });
  } catch (error) {
    const duplicate = String(error).includes("UNIQUE constraint failed");
    console.error(JSON.stringify({ event: "admin_product_image_create_failed", channelId, productId, imageAssetId: parsed.imageAssetId, error: String(error) }));
    return redirect(request, channelId, productId, { error: duplicate ? "image-duplicate" : "database" });
  }
};
