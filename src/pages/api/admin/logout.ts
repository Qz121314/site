import type { APIRoute } from "astro";
import { clearSessionCookie, isSameOriginPost } from "@/lib/auth/session";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/admin/login",
      "Set-Cookie": clearSessionCookie(new URL(request.url).protocol === "https:"),
      "Cache-Control": "no-store",
    },
  });
};
