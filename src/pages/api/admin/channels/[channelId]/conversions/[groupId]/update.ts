import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import {
  conversionGroupNameExists,
  isConversionAvailabilityConstraintError,
  isDuplicateConversionGroupNameError,
  parseConversionGroupForm,
} from "@/lib/admin/conversion-form";

export const prerender = false;

function redirect(request: Request, channelId: string, params: Record<string, string>): Response {
  const url = new URL(`/admin/channels/${encodeURIComponent(channelId)}/conversions`, request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request, params }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const channelId = params.channelId ?? "";
  const groupId = params.groupId ?? "";
  if (!channelId || !groupId) return new Response("Not Found", { status: 404 });

  const parsed = parseConversionGroupForm(await request.formData());
  if (!parsed.ok) return redirect(request, channelId, { error: parsed.code, group: groupId });

  const { name, status } = parsed.value;

  try {
    const existing = await env.DB.prepare(
      `SELECT
         conversion_group.id,
         conversion_group.status,
         EXISTS(
           SELECT 1
           FROM products product
           WHERE product.channel_id = conversion_group.channel_id
             AND product.conversion_group_id = conversion_group.id
             AND product.status = 'published'
         ) AS published_products
       FROM conversion_groups conversion_group
       WHERE conversion_group.id = ?1 AND conversion_group.channel_id = ?2`,
    ).bind(groupId, channelId).first<{ id: string; status: string; published_products: number }>();
    if (!existing) return redirect(request, channelId, { error: "not-found" });
    if (existing.status === "enabled" && status === "disabled" && Boolean(existing.published_products)) {
      return redirect(request, channelId, { error: "group-in-use", group: groupId });
    }

    if (await conversionGroupNameExists(channelId, name, groupId)) {
      return redirect(request, channelId, { error: "group-duplicate", group: groupId });
    }

    await env.DB.prepare(
      `UPDATE conversion_groups
       SET name = ?3,
           status = ?4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1 AND channel_id = ?2`,
    ).bind(groupId, channelId, name, status).run();

    return redirect(request, channelId, { saved: "group-updated", group: groupId });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_conversion_group_update_failed", channelId, groupId, name, error: String(error) }));
    return redirect(request, channelId, {
      error: isDuplicateConversionGroupNameError(error)
        ? "group-duplicate"
        : isConversionAvailabilityConstraintError(error)
          ? "group-in-use"
          : "database",
      group: groupId,
    });
  }
};
