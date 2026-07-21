import { env } from "cloudflare:workers";
import { defineMiddleware } from "astro:middleware";
import { readCookie, SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/api/admin/login"]);
const PUBLIC_EDGE_CACHE_SECONDS = 30;

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");
}

function isAdminImageContent(request: Request, pathname: string): boolean {
  return request.method === "GET"
    && pathname.startsWith("/api/admin/images/")
    && pathname.endsWith("/content");
}

function isPublicEdgeCacheable(request: Request, pathname: string, response: Response): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (isAdminPath(pathname) || pathname.startsWith("/api/") || pathname.startsWith("/go/")) return false;

  const cacheControl = response.headers.get("Cache-Control") ?? "";
  if (/\b(?:no-store|private)\b/iu.test(cacheControl)) return false;
  if (response.status >= 300 && response.status < 400) return response.headers.has("Location");
  if (response.status !== 200) return false;
  return (response.headers.get("Content-Type") ?? "").includes("text/html");
}

function addSecurityHeaders(response: Response, request: Request, pathname: string): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (isAdminPath(pathname)) {
    if (!isAdminImageContent(request, pathname)) headers.set("Cache-Control", "no-store");
    headers.set("X-Robots-Tag", "noindex, nofollow");
  } else if (pathname.startsWith("/api/") || pathname.startsWith("/go/")) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
  } else if (response.status >= 400) {
    headers.set("X-Robots-Tag", "noindex, follow");
  } else if (isPublicEdgeCacheable(request, pathname, response)) {
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    headers.set(
      "Cloudflare-CDN-Cache-Control",
      `public, max-age=${PUBLIC_EDGE_CACHE_SECONDS}, stale-while-revalidate=${PUBLIC_EDGE_CACHE_SECONDS * 2}`,
    );
  }

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname;
  const requiresAdmin = isAdminPath(pathname) && !PUBLIC_ADMIN_PATHS.has(pathname);

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

  return addSecurityHeaders(await next(), context.request, pathname);
});
