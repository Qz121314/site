import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import {
  deleteUnusedImageAssets,
  loadUnusedImageObjectsForCleanup,
} from "@/lib/db/images";

export const prerender = false;

function redirect(request: Request, params: Record<string, string>): Response {
  const url = new URL("/admin/images", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  try {
    const candidates = await loadUnusedImageObjectsForCleanup();
    if (candidates.length === 0) return redirect(request, { saved: "clean", count: "0" });

    const result = await deleteUnusedImageAssets(candidates.map((image) => image.id));
    if (result.deleted.length > 0) {
      try {
        await env.MEDIA_BUCKET.delete(result.deleted.map((image) => image.objectKey));
      } catch (error) {
        console.error(JSON.stringify({ event: "admin_image_cleanup_r2_deferred", error: String(error) }));
      }
    }

    return redirect(request, { saved: "clean", count: String(result.deleted.length) });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_image_cleanup_failed", error: String(error) }));
    return redirect(request, { error: "cleanup" });
  }
};
