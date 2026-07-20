import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import { loadAdminImage } from "@/lib/db/images";

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
    const image = await loadAdminImage(imageId);
    if (!image) return redirect(request, { error: "not-found" });
    if (image.referenceCount > 0) return redirect(request, { error: "in-use" });

    await env.MEDIA_BUCKET.delete(image.objectKey);
    await env.DB.prepare("DELETE FROM image_assets WHERE id = ?1").bind(image.id).run();
    return redirect(request, { saved: "deleted" });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_image_delete_failed", imageId, error: String(error) }));
    return redirect(request, { error: "delete" });
  }
};
