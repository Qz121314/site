import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { createSessionToken, isSameOriginPost, safeCompareText, sessionCookie } from "@/lib/auth/session";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const form = await request.formData();
  const password = form.get("password");
  const valid = typeof password === "string" && await safeCompareText(password, env.ADMIN_PASSWORD);
  if (!valid) return Response.redirect(new URL("/admin/login?error=1", request.url), 303);

  const token = await createSessionToken(env.SESSION_SECRET);
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/admin/channels",
      "Set-Cookie": sessionCookie(token, new URL(request.url).protocol === "https:"),
      "Cache-Control": "no-store",
    },
  });
};
