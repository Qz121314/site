import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import {
  conversionGroupNameExists,
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
      "SELECT id FROM conversion_groups WHERE id = ?1 AND channel_id = ?2",
    ).bind(groupId, channelId).first<{ id: string }>();
    if (!existing) return redirect(request, channelId, { error: "not-found" });

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
      error: isDuplicateConversionGroupNameError(error) ? "group-duplicate" : "database",
      group: groupId,
    });
  }
};
