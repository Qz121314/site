import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import { deleteUnusedImageAssets } from "@/lib/db/images";

export const prerender = false;

function redirect(request: Request, params: Record<string, string>): Response {
  const url = new URL("/admin/images", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request, params }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const imageId = params.imageId ?? "";
  if (!imageId) return new Response("Not Found", { status: 404 });

  try {
    const result = await deleteUnusedImageAssets([imageId]);
    if (result.found.length === 0) return redirect(request, { error: "not-found" });
    if (result.deleted.length === 0) return redirect(request, { error: "in-use" });

    try {
      await env.MEDIA_BUCKET.delete(result.deleted[0]?.objectKey ?? "");
    } catch (error) {
      console.error(JSON.stringify({ event: "admin_image_r2_cleanup_deferred", imageId, error: String(error) }));
    }
    return redirect(request, { saved: "deleted" });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_image_delete_failed", imageId, error: String(error) }));
    return redirect(request, { error: "delete" });
  }
};
