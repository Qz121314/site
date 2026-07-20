import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import { deleteUnusedImageAssets, MAX_IMAGE_MUTATION_IDS } from "@/lib/db/images";

export const prerender = false;

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function redirect(request: Request, params: Record<string, string>): Response {
  const url = new URL("/admin/images", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const form = await request.formData();
  const imageIds = [...new Set(
    form.getAll("imageIds")
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean),
  )];

  if (
    imageIds.length === 0 ||
    imageIds.length > MAX_IMAGE_MUTATION_IDS ||
    imageIds.some((imageId) => !ID_PATTERN.test(imageId))
  ) {
    return redirect(request, { error: "bulk-selection" });
  }

  try {
    const result = await deleteUnusedImageAssets(imageIds);
    if (result.found.length !== imageIds.length) return redirect(request, { error: "not-found" });
    if (result.remainingIds.length > 0) return redirect(request, { error: "in-use" });

    try {
      await env.MEDIA_BUCKET.delete(result.deleted.map((image) => image.objectKey));
    } catch (error) {
      console.error(JSON.stringify({ event: "admin_image_bulk_r2_cleanup_deferred", imageIds, error: String(error) }));
    }

    return redirect(request, { saved: "bulk-deleted", count: String(result.deleted.length) });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_image_bulk_delete_failed", imageIds, error: String(error) }));
    return redirect(request, { error: "delete" });
  }
};
