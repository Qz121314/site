import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import { loadAdminImages } from "@/lib/db/images";

export const prerender = false;

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAX_BULK_DELETE = 100;

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
    imageIds.length > MAX_BULK_DELETE ||
    imageIds.some((imageId) => !ID_PATTERN.test(imageId))
  ) {
    return redirect(request, { error: "bulk-selection" });
  }

  try {
    const images = await loadAdminImages(imageIds);
    if (images.length !== imageIds.length) return redirect(request, { error: "not-found" });
    if (images.some((image) => image.referenceCount > 0)) {
      return redirect(request, { error: "in-use" });
    }

    await env.MEDIA_BUCKET.delete(images.map((image) => image.objectKey));
    const placeholders = images.map((_, index) => `?${index + 1}`).join(", ");
    await env.DB.prepare(
      `DELETE FROM image_assets WHERE id IN (${placeholders})`,
    ).bind(...images.map((image) => image.id)).run();

    return redirect(request, { saved: "bulk-deleted", count: String(images.length) });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_image_bulk_delete_failed", imageIds, error: String(error) }));
    return redirect(request, { error: "delete" });
  }
};
