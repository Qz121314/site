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
  if (!channelId) return new Response("Not Found", { status: 404 });

  const parsed = parseConversionGroupForm(await request.formData());
  if (!parsed.ok) return redirect(request, channelId, { error: parsed.code });

  const { name, status } = parsed.value;
  const id = crypto.randomUUID();

  try {
    const channel = await env.DB.prepare("SELECT id FROM channels WHERE id = ?1")
      .bind(channelId)
      .first<{ id: string }>();
    if (!channel) return redirect(request, channelId, { error: "not-found" });

    if (await conversionGroupNameExists(channelId, name)) {
      return redirect(request, channelId, { error: "group-duplicate" });
    }

    await env.DB.prepare(
      `INSERT INTO conversion_groups (id, channel_id, name, status)
       VALUES (?1, ?2, ?3, ?4)`,
    ).bind(id, channelId, name, status).run();

    return redirect(request, channelId, { saved: "group-created", group: id });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_conversion_group_create_failed", channelId, name, error: String(error) }));
    return redirect(request, channelId, {
      error: isDuplicateConversionGroupNameError(error) ? "group-duplicate" : "database",
    });
  }
};
