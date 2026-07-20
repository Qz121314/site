import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import {
  conversionGroupBelongsToChannel,
  parseConversionResourceForm,
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

  const parsed = parseConversionResourceForm(await request.formData());
  if (!parsed.ok) return redirect(request, channelId, { error: parsed.code, group: groupId });

  const { type, value, sortOrder, status } = parsed.value;
  const id = crypto.randomUUID();

  try {
    if (!(await conversionGroupBelongsToChannel(channelId, groupId))) {
      return redirect(request, channelId, { error: "not-found" });
    }

    await env.DB.prepare(
      `INSERT INTO conversion_resources (id, group_id, type, value, sort_order, status)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    ).bind(id, groupId, type, value, sortOrder, status).run();

    return redirect(request, channelId, { saved: "resource-created", group: groupId });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_conversion_resource_create_failed", channelId, groupId, type, error: String(error) }));
    return redirect(request, channelId, { error: "database", group: groupId });
  }
};
