import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";

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

  try {
    const row = await env.DB.prepare(
      `SELECT
         g.id,
         COUNT(p.id) AS product_count
       FROM conversion_groups g
       LEFT JOIN products p
         ON p.conversion_group_id = g.id
        AND p.channel_id = g.channel_id
       WHERE g.id = ?1 AND g.channel_id = ?2
       GROUP BY g.id`,
    ).bind(groupId, channelId).first<{ id: string; product_count: number }>();

    if (!row) return redirect(request, channelId, { error: "not-found" });
    if (Number(row.product_count ?? 0) > 0) {
      return redirect(request, channelId, { error: "group-in-use", group: groupId });
    }

    await env.DB.prepare(
      "DELETE FROM conversion_groups WHERE id = ?1 AND channel_id = ?2",
    ).bind(groupId, channelId).run();

    return redirect(request, channelId, { saved: "group-deleted" });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_conversion_group_delete_failed", channelId, groupId, error: String(error) }));
    return redirect(request, channelId, { error: "database", group: groupId });
  }
};
