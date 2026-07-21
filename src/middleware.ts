import { env } from "cloudflare:workers";
import { defineMiddleware } from "astro:middleware";
import { readCookie, SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/api/admin/login"]);
const PUBLIC_EDGE_CACHE_SECONDS = 30;
const PUBLIC_READINESS_SUCCESS_TTL_MS = 30_000;
const PUBLIC_READINESS_FAILURE_TTL_MS = 5_000;

type PublicReadinessCache = {
  ready: boolean;
  expiresAt: number;
};

let publicReadinessCache: PublicReadinessCache | null = null;

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");
}

function isAdminImageContent(request: Request, pathname: string): boolean {
  return request.method === "GET"
    && pathname.startsWith("/api/admin/images/")
    && pathname.endsWith("/content");
}

function requiresPublicData(request: Request, pathname: string): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (isAdminPath(pathname) || pathname === "/api/health" || pathname === "/robots.txt") return false;
  return true;
}

async function publicDataReady(): Promise<boolean> {
  const now = Date.now();
  if (publicReadinessCache && publicReadinessCache.expiresAt > now) {
    return publicReadinessCache.ready;
  }

  let ready = false;
  try {
    const row = await env.DB.prepare(
      `SELECT
         s.id,
         s.site_name,
         s.site_description,
         s.logo_asset_id,
         s.favicon_asset_id,
         s.default_channel_id,
         s.r2_public_base_url,
         s.ga4_id,
         s.meta_pixel_id,
         s.adult_gate_enabled,
         s.all_filter_label,
         s.privacy_content,
         s.disclaimer_content,
         EXISTS(SELECT 1 FROM channels LIMIT 1) AS channels_ready,
         EXISTS(SELECT 1 FROM image_assets LIMIT 1) AS images_ready,
         EXISTS(SELECT 1 FROM categories LIMIT 1) AS categories_ready,
         EXISTS(SELECT 1 FROM category_filters LIMIT 1) AS filters_ready,
         EXISTS(SELECT 1 FROM category_filter_relations LIMIT 1) AS filter_relations_ready,
         EXISTS(SELECT 1 FROM products LIMIT 1) AS products_ready,
         EXISTS(SELECT 1 FROM product_images LIMIT 1) AS product_images_ready,
         EXISTS(SELECT 1 FROM ad_pools LIMIT 1) AS ad_pools_ready,
         EXISTS(SELECT 1 FROM advertisements LIMIT 1) AS advertisements_ready,
         EXISTS(SELECT 1 FROM conversion_groups LIMIT 1) AS conversion_groups_ready,
         EXISTS(SELECT 1 FROM conversion_resources LIMIT 1) AS conversion_resources_ready
       FROM site_settings s
       WHERE s.id = 1`,
    ).first<{ id: number }>();
    ready = row?.id === 1;
  } catch (error) {
    console.error(JSON.stringify({ event: "public_readiness_check_failed", error: String(error) }));
  }

  publicReadinessCache = {
    ready,
    expiresAt: now + (ready ? PUBLIC_READINESS_SUCCESS_TTL_MS : PUBLIC_READINESS_FAILURE_TTL_MS),
  };
  return ready;
}

function serviceUnavailableResponse(request: Request, pathname: string): Response {
  const wantsJson = pathname.startsWith("/api/")
    || pathname.startsWith("/go/")
    || (request.headers.get("Accept") ?? "").includes("application/json");
  const headers = {
    "Cache-Control": "no-store",
    "Retry-After": "30",
    "X-Robots-Tag": "noindex, nofollow",
  };

  if (wantsJson) {
    return new Response(request.method === "HEAD" ? null : JSON.stringify({
      error: "SERVICE_UNAVAILABLE",
      message: "Public catalog data is temporarily unavailable.",
    }), {
      status: 503,
      headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Temporarily unavailable</title>
  <style>
    :root{color-scheme:dark}*{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:1.5rem;font-family:system-ui,sans-serif;background:#080a0d;color:#f4f1ea}.card{width:min(100%,34rem);padding:2rem;border:1px solid #272b31;border-radius:1rem;background:#111419;text-align:center}h1{margin:0 0 .75rem;font-size:clamp(1.8rem,6vw,2.8rem)}p{margin:0;color:#aeb4bd;line-height:1.6}
  </style>
</head>
<body><main class="card"><h1>Temporarily unavailable</h1><p>The catalog data service is unavailable. Please try again shortly.</p></main></body>
</html>`;

  return new Response(request.method === "HEAD" ? null : body, {
    status: 503,
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  });
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
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex, nofollow",
          },
        });
      }
      return context.redirect("/admin/login", 302);
    }
  }

  if (requiresPublicData(context.request, pathname) && !(await publicDataReady())) {
    return addSecurityHeaders(serviceUnavailableResponse(context.request, pathname), context.request, pathname);
  }

  return addSecurityHeaders(await next(), context.request, pathname);
});
