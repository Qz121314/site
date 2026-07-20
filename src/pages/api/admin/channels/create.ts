import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import { isDuplicateChannelSlugError, parseChannelForm } from "@/lib/admin/channel-form";

export const prerender = false;

function redirect(request: Request, params: Record<string, string>): Response {
  const url = new URL("/admin/channels", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const parsed = parseChannelForm(await request.formData());
  if (!parsed.ok) return redirect(request, { error: parsed.code });

  const { name, slug, icon, sortOrder, status } = parsed.value;
  const id = crypto.randomUUID();

  try {
    await env.DB.prepare(
      `INSERT INTO channels (id, name, slug, icon, sort_order, status)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    ).bind(id, name, slug, icon, sortOrder, status).run();
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_channel_create_failed", slug, error: String(error) }));
    return redirect(request, { error: isDuplicateChannelSlugError(error) ? "duplicate" : "database" });
  }

  return redirect(request, { saved: "created", channel: id });
};
