import { env } from "cloudflare:workers";
import { defineMiddleware } from "astro:middleware";
import { readCookie, SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { publicHtmlEdgeCacheSeconds } from "@/lib/public/cache-policy";
import { resolvePublicOrigin } from "@/lib/public/origin";

const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/api/admin/login"]);
const DATA_INDEPENDENT_PATHS = new Set([
  "/admin/login",
  "/api/admin/login",
  "/api/admin/logout",
  "/api/health",
  "/robots.txt",
]);
const DATA_READINESS_SUCCESS_TTL_MS = 30_000;
const DATA_READINESS_FAILURE_TTL_MS = 5_000;

type DataReadinessCache = {
  ready: boolean;
  expiresAt: number;
};

let dataReadinessCache: DataReadinessCache | null = null;

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");
}

function isAdminImageContent(request: Request, pathname: string): boolean {
  return request.method === "GET"
    && pathname.startsWith("/api/admin/images/")
    && pathname.endsWith("/content");
}

function requiresApplicationData(request: Request, pathname: string): boolean {
  if (DATA_INDEPENDENT_PATHS.has(pathname)) return false;
  if (isAdminPath(pathname)) return true;
  return request.method === "GET" || request.method === "HEAD";
}

async function applicationDataReady(): Promise<boolean> {
  const now = Date.now();
  if (dataReadinessCache && dataReadinessCache.expiresAt > now) {
    return dataReadinessCache.ready;
  }

  let ready = false;
  try {
    const row = await env.DB.prepare(
      `SELECT
         settings.id,
         settings.r2_public_base_url,
         (SELECT thumbnail_object_key FROM image_assets LIMIT 1) AS image_probe,
         (SELECT hero_ad_pool_id FROM channels LIMIT 1) AS channel_probe,
         (SELECT status FROM category_filters LIMIT 1) AS filter_probe,
         (SELECT status FROM categories LIMIT 1) AS category_probe,
         (SELECT status FROM ad_pools LIMIT 1) AS ad_pool_probe,
         (SELECT status FROM advertisements LIMIT 1) AS ad_probe,
         (SELECT status FROM conversion_groups LIMIT 1) AS conversion_group_probe,
         (SELECT status FROM conversion_resources LIMIT 1) AS conversion_resource_probe,
         (SELECT cover_asset_id FROM products LIMIT 1) AS product_probe,
         (SELECT image_asset_id FROM product_images LIMIT 1) AS product_image_probe
       FROM site_settings settings
       WHERE settings.id = 1`,
    ).first<{ id: number }>();
    ready = row?.id === 1;
  } catch (error) {
    console.error(JSON.stringify({ event: "application_readiness_check_failed", error: String(error) }));
  }

  dataReadinessCache = {
    ready,
    expiresAt: now + (ready ? DATA_READINESS_SUCCESS_TTL_MS : DATA_READINESS_FAILURE_TTL_MS),
  };
  return ready;
}

function serviceUnavailableResponse(request: Request, pathname: string): Response {
  const admin = isAdminPath(pathname);
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
      message: admin
        ? "Admin data is temporarily unavailable."
        : "Public catalog data is temporarily unavailable.",
    }), {
      status: 503,
      headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const language = admin ? "zh-CN" : "en";
  const title = admin ? "数据服务暂不可用" : "Temporarily unavailable";
  const message = admin
    ? "后台数据服务或数据库迁移状态异常，请检查健康接口和部署日志后重试。"
    : "The catalog data service is unavailable. Please try again shortly.";
  const body = `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${title}</title>
  <style>
    :root{color-scheme:dark}*{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:1.5rem;font-family:system-ui,sans-serif;background:#080a0d;color:#f4f1ea}.card{width:min(100%,38rem);padding:2rem;border:1px solid #272b31;border-radius:1rem;background:#111419;text-align:center}h1{margin:0 0 .75rem;font-size:clamp(1.8rem,6vw,2.8rem)}p{margin:0;color:#aeb4bd;line-height:1.6}
  </style>
</head>
<body><main class="card"><h1>${title}</h1><p>${message}</p></main></body>
</html>`;

  return new Response(request.method === "HEAD" ? null : body, {
    status: 503,
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  });
}

function isPublicEdgeCacheable(request: Request, pathname: string, response: Response): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (readCookie(request.headers.get("Cookie"), SESSION_COOKIE)) return false;
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
      `public, max-age=${publicHtmlEdgeCacheSeconds(pathname)}, must-revalidate`,
    );
  }

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function downstreamRequest(context: Parameters<Parameters<typeof defineMiddleware>[0]>[0]): Request {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") return context.request;

  const origin = resolvePublicOrigin(context.url, context.request.headers);
  if (origin === context.url.origin) return context.request;

  const url = new URL(`${context.url.pathname}${context.url.search}${context.url.hash}`, origin);
  return new Request(url, context.request);
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

  if (requiresApplicationData(context.request, pathname) && !(await applicationDataReady())) {
    return addSecurityHeaders(serviceUnavailableResponse(context.request, pathname), context.request, pathname);
  }

  const request = downstreamRequest(context);
  return addSecurityHeaders(await next(request), request, pathname);
});
