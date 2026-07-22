import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { adminReturnUrl, redirectAdmin } from "@/lib/admin/admin-return";
import { isProductConversionAvailabilityConstraintError } from "@/lib/admin/pool-integrity";
import { parseProductManagementForm, prepareProductPublishing } from "@/lib/admin/product-form";
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
  const parsed = parseProductManagementForm(form);
  if (!parsed.ok) return redirectAdmin(returnUrl, { error: parsed.code, saved: null });

  try {
    if (parsed.value.status === "published") {
      const publishError = await prepareProductPublishing(channelId, productId);
      if (publishError) return redirectAdmin(returnUrl, { error: publishError, saved: null });
    }

    const statements = [];
    if (parsed.value.status === "published") {
      statements.push(env.DB.prepare(
        `UPDATE categories
         SET status = 'published', updated_at = CURRENT_TIMESTAMP
         WHERE id = (SELECT category_id FROM products WHERE id = ?1 AND channel_id = ?2)`,
      ).bind(productId, channelId));
    }
    statements.push(env.DB.prepare(
      `UPDATE products
       SET sort_order = ?1,
           status = ?2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?3 AND channel_id = ?4`,
    ).bind(parsed.value.sortOrder, parsed.value.status, productId, channelId));

    const results = await env.DB.batch(statements);
    if (!results.at(-1)?.meta.changes) return redirectAdmin(returnUrl, { error: "not-found", saved: null });
    return redirectAdmin(returnUrl, { saved: "managed", error: null });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_product_manage_failed", channelId, productId, error: String(error) }));
    return redirectAdmin(returnUrl, {
      error: isProductConversionAvailabilityConstraintError(error) ? "conversion-unavailable" : "database",
      saved: null,
    });
  }
};
