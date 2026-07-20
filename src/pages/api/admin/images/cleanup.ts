import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import { loadUnusedImagesForCleanup } from "@/lib/db/images";

export const prerender = false;

function redirect(request: Request, params: Record<string, string>): Response {
  const url = new URL("/admin/images", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  try {
    const images = await loadUnusedImagesForCleanup();
    if (images.length === 0) return redirect(request, { saved: "clean", count: "0" });

    await env.MEDIA_BUCKET.delete(images.map((image) => image.objectKey));
    await env.DB.batch(
      images.map((image) => env.DB.prepare("DELETE FROM image_assets WHERE id = ?1").bind(image.id)),
    );

    return redirect(request, { saved: "clean", count: String(images.length) });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_image_cleanup_failed", error: String(error) }));
    return redirect(request, { error: "cleanup" });
  }
};
