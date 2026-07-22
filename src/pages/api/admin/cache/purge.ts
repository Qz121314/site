import { cache } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import { clearPublicSiteShellCache } from "@/lib/db/public";

export const prerender = false;

function redirect(request: Request, status: "refreshed" | "error"): Response {
  const url = new URL("/admin/settings", request.url);
  url.searchParams.set("cache", status);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  clearPublicSiteShellCache();

  try {
    const result = await cache.purge({ purgeEverything: true });
    if (!result.success) {
      console.error(JSON.stringify({
        event: "admin_public_cache_purge_failed",
        errors: result.errors,
      }));
      return redirect(request, "error");
    }

    console.info(JSON.stringify({ event: "admin_public_cache_purged" }));
    return redirect(request, "refreshed");
  } catch (error) {
    console.error(JSON.stringify({
      event: "admin_public_cache_purge_failed",
      error: String(error),
    }));
    return redirect(request, "error");
  }
};
