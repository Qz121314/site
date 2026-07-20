import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";

export const prerender = false;

function redirect(request: Request, channelId: string, params: Record<string, string>): Response {
  const url = new URL(`/admin/channels/${encodeURIComponent(channelId)}/filters`, request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request, params }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const channelId = params.channelId ?? "";
  const categoryId = params.categoryId ?? "";
  if (!channelId || !categoryId) return new Response("Not Found", { status: 404 });

  try {
    const category = await env.DB.prepare(
      `SELECT
         c.id,
         COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.channel_id = c.channel_id
       WHERE c.id = ?1 AND c.channel_id = ?2
       GROUP BY c.id`,
    ).bind(categoryId, channelId).first<{ id: string; product_count: number }>();

    if (!category) return redirect(request, channelId, { error: "not-found" });
    if (Number(category.product_count ?? 0) > 0) return redirect(request, channelId, { error: "in-use" });

    await env.DB.prepare("DELETE FROM categories WHERE id = ?1 AND channel_id = ?2")
      .bind(categoryId, channelId)
      .run();

    return redirect(request, channelId, { saved: "deleted" });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_category_delete_failed", channelId, categoryId, error: String(error) }));
    return redirect(request, channelId, { error: "database" });
  }
};
