import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import { isConversionAvailabilityConstraintError, parseConversionResourceForm } from "@/lib/admin/conversion-form";
import { wouldRemoveLastEnabledConversionResource } from "@/lib/admin/conversion-resource-guard";

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
  const resourceId = params.resourceId ?? "";
  if (!channelId || !groupId || !resourceId) return new Response("Not Found", { status: 404 });

  const parsed = parseConversionResourceForm(await request.formData());
  if (!parsed.ok) return redirect(request, channelId, { error: parsed.code, group: groupId });

  const { type, value, sortOrder, status } = parsed.value;

  try {
    const existing = await env.DB.prepare(
      `SELECT r.id, r.status
       FROM conversion_resources r
       INNER JOIN conversion_groups g ON g.id = r.group_id
       WHERE r.id = ?1 AND r.group_id = ?2 AND g.channel_id = ?3`,
    ).bind(resourceId, groupId, channelId).first<{ id: string; status: string }>();
    if (!existing) return redirect(request, channelId, { error: "not-found" });

    if (
      existing.status === "enabled" &&
      status === "disabled" &&
      await wouldRemoveLastEnabledConversionResource(channelId, groupId, resourceId)
    ) {
      return redirect(request, channelId, { error: "group-in-use", group: groupId });
    }

    await env.DB.prepare(
      `UPDATE conversion_resources
       SET type = ?3,
           value = ?4,
           sort_order = ?5,
           status = ?6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1 AND group_id = ?2`,
    ).bind(resourceId, groupId, type, value, sortOrder, status).run();

    return redirect(request, channelId, { saved: "resource-updated", group: groupId });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_conversion_resource_update_failed", channelId, groupId, resourceId, error: String(error) }));
    return redirect(request, channelId, {
      error: isConversionAvailabilityConstraintError(error) ? "group-in-use" : "database",
      group: groupId,
    });
  }
};
