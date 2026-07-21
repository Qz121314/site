import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import {
  deleteQueuedImageObjectsFromR2,
  deleteUnusedImageAssetsAtomically,
} from "@/lib/db/image-delete";
import { MAX_IMAGE_MUTATION_IDS } from "@/lib/db/images";

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
    const result = await deleteUnusedImageAssetsAtomically(imageIds);
    if (result.found.length !== imageIds.length) return redirect(request, { error: "not-found" });
    if (result.deleted.length !== imageIds.length) return redirect(request, { error: "in-use" });

    const r2 = await deleteQueuedImageObjectsFromR2(result.deleted);
    if (r2.pending.length > 0) {
      console.error(JSON.stringify({
        event: "admin_image_bulk_r2_cleanup_deferred",
        imageIds,
        objectKeys: r2.pending.map((image) => image.objectKey),
      }));
    }

    return redirect(request, {
      saved: r2.pending.length > 0 ? "bulk-delete-pending" : "bulk-deleted",
      count: String(result.deleted.length),
      pending: String(r2.pending.length),
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_image_bulk_delete_failed", imageIds, error: String(error) }));
    return redirect(request, { error: "delete" });
  }
};
