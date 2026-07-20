import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import {
  isDuplicateProductSlugError,
  parseProductForm,
  validateProductRelations,
} from "@/lib/admin/product-form";

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

  const parsed = parseProductForm(await request.formData());
  if (!parsed.ok) return redirect(request, channelId, productId, { error: parsed.code });

  const value = parsed.value;

  try {
    const product = await env.DB.prepare(
      "SELECT id FROM products WHERE id = ?1 AND channel_id = ?2",
    ).bind(productId, channelId).first<{ id: string }>();
    if (!product) return redirect(request, channelId, productId, { error: "not-found" });

    const relationError = await validateProductRelations(
      channelId,
      value.categoryId,
      value.conversionGroupId,
      value.status,
    );
    if (relationError) return redirect(request, channelId, productId, { error: relationError });

    await env.DB.prepare(
      `UPDATE products
       SET category_id = ?1,
           conversion_group_id = ?2,
           title = ?3,
           slug = ?4,
           tags = ?5,
           body_source = ?6,
           body_html = ?7,
           cta_label = ?8,
           featured = ?9,
           sort_order = ?10,
           status = ?11,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?12 AND channel_id = ?13`,
    ).bind(
      value.categoryId,
      value.conversionGroupId,
      value.title,
      value.slug,
      value.tagsJson,
      value.bodySource,
      value.bodyHtml,
      value.ctaLabel,
      value.featured ? 1 : 0,
      value.sortOrder,
      value.status,
      productId,
      channelId,
    ).run();

    return redirect(request, channelId, productId, { saved: "updated" });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_product_update_failed", channelId, productId, slug: value.slug, error: String(error) }));
    return redirect(request, channelId, productId, {
      error: isDuplicateProductSlugError(error) ? "duplicate" : "database",
    });
  }
};
