import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import {
  isDuplicateProductSlugError,
  parseProductForm,
  validateProductRelations,
} from "@/lib/admin/product-form";

export const prerender = false;

function listRedirect(request: Request, channelId: string, error: string): Response {
  const url = new URL(`/admin/channels/${encodeURIComponent(channelId)}/products`, request.url);
  url.searchParams.set("error", error);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request, params }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const channelId = params.channelId ?? "";
  if (!channelId) return new Response("Not Found", { status: 404 });

  const parsed = parseProductForm(await request.formData(), true);
  if (!parsed.ok) return listRedirect(request, channelId, parsed.code);

  const value = parsed.value;
  const productId = crypto.randomUUID();

  try {
    const channel = await env.DB.prepare("SELECT id FROM channels WHERE id = ?1")
      .bind(channelId)
      .first<{ id: string }>();
    if (!channel) return listRedirect(request, channelId, "not-found");

    const relationError = await validateProductRelations(
      channelId,
      value.categoryId,
      value.conversionGroupId,
      value.status,
    );
    if (relationError) return listRedirect(request, channelId, relationError);

    await env.DB.prepare(
      `INSERT INTO products (
         id, channel_id, category_id, conversion_group_id,
         title, slug, tags, body_source, body_html, cta_label,
         featured, sort_order, status
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
    ).bind(
      productId,
      channelId,
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
    ).run();

    const url = new URL(
      `/admin/channels/${encodeURIComponent(channelId)}/products/${encodeURIComponent(productId)}`,
      request.url,
    );
    url.searchParams.set("saved", "created");
    return Response.redirect(url, 303);
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_product_create_failed", channelId, slug: value.slug, error: String(error) }));
    return listRedirect(request, channelId, isDuplicateProductSlugError(error) ? "duplicate" : "database");
  }
};
