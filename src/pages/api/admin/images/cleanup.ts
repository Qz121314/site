import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import {
  deleteQueuedImageObjectsFromR2,
  deleteUnusedImageAssetsAtomically,
  loadQueuedImageObjects,
} from "@/lib/db/image-delete";
import { loadUnusedImageObjectsForCleanup } from "@/lib/db/images";

export const prerender = false;

function redirect(request: Request, params: Record<string, string>): Response {
  const url = new URL("/admin/images", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  try {
    const queued = await loadQueuedImageObjects();
    const retryResult = await deleteQueuedImageObjectsFromR2(queued);

    const candidates = await loadUnusedImageObjectsForCleanup();
    const deletion = candidates.length > 0
      ? await deleteUnusedImageAssetsAtomically(candidates.map((image) => image.id))
      : { found: [], deleted: [], remainingIds: [] };
    const r2Result = await deleteQueuedImageObjectsFromR2(deletion.deleted);
    const pending = retryResult.pending.length + r2Result.pending.length;

    if (pending > 0) {
      console.error(JSON.stringify({
        event: "admin_image_cleanup_r2_deferred",
        pending,
        objectKeys: [...retryResult.pending, ...r2Result.pending].map((image) => image.objectKey),
      }));
    }

    return redirect(request, {
      saved: pending > 0 ? "clean-pending" : "clean",
      count: String(deletion.deleted.length),
      retried: String(retryResult.completed.length),
      pending: String(pending),
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_image_cleanup_failed", error: String(error) }));
    return redirect(request, { error: "cleanup" });
  }
};
