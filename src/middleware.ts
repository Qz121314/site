import { env } from "cloudflare:workers";
import { defineMiddleware } from "astro:middleware";
import { readCookie, SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/api/admin/login"]);

function addSecurityHeaders(response: Response, pathname: string): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    headers.set("Cache-Control", "no-store");
    headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname;
  const requiresAdmin =
    (pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/")) &&
    !PUBLIC_ADMIN_PATHS.has(pathname);

  if (requiresAdmin) {
    const token = readCookie(context.request.headers.get("Cookie"), SESSION_COOKIE);
    const authenticated = token ? await verifySessionToken(token, env.SESSION_SECRET) : false;
    if (!authenticated) {
      if (pathname.startsWith("/api/admin/")) {
        return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
          status: 401,
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
        });
      }
      return context.redirect("/admin/login", 302);
    }
  }

  return addSecurityHeaders(await next(), pathname);
});
