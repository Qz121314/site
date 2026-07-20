import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import {
  MAX_IMAGE_BYTES,
  MAX_UPLOAD_REQUEST_BYTES,
  createImageObjectKey,
  inspectImage,
  normalizeOriginalName,
} from "@/lib/admin/image-form";

export const prerender = false;

function redirect(request: Request, params: Record<string, string>): Response {
  const url = new URL("/admin/images", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

function wantsJson(request: Request): boolean {
  return request.headers.get("Accept")?.includes("application/json") === true;
}

function fail(request: Request, code: string, status = 400): Response {
  return wantsJson(request)
    ? Response.json({ ok: false, error: code }, { status })
    : redirect(request, { error: code });
}

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_REQUEST_BYTES) {
    return fail(request, "too-large", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(request, "invalid-form");
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail(request, "file");
  if (file.size > MAX_IMAGE_BYTES) return fail(request, "too-large", 413);

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return fail(request, "read");
  }

  const inspected = inspectImage(bytes, file.type);
  if (!inspected) return fail(request, "format");

  const id = crypto.randomUUID();
  const objectKey = createImageObjectKey(inspected.extension);
  const originalNameValue = form.get("originalName");
  const originalName = normalizeOriginalName(
    typeof originalNameValue === "string" && originalNameValue.trim() ? originalNameValue : file.name,
  );

  try {
    await env.MEDIA_BUCKET.put(objectKey, bytes, {
      httpMetadata: {
        contentType: inspected.mimeType,
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: {
        assetId: id,
        width: String(inspected.width),
        height: String(inspected.height),
        originalName,
      },
    });

    try {
      await env.DB.prepare(
        `INSERT INTO image_assets
           (id, object_key, original_name, mime_type, width, height, size_bytes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      ).bind(
        id,
        objectKey,
        originalName,
        inspected.mimeType,
        inspected.width,
        inspected.height,
        bytes.byteLength,
      ).run();
    } catch (error) {
      await env.MEDIA_BUCKET.delete(objectKey);
      throw error;
    }

    if (wantsJson(request)) {
      return Response.json({
        ok: true,
        image: {
          id,
          objectKey,
          originalName,
          mimeType: inspected.mimeType,
          width: inspected.width,
          height: inspected.height,
          sizeBytes: bytes.byteLength,
        },
      });
    }

    return redirect(request, { saved: "uploaded" });
  } catch (error) {
    console.error(JSON.stringify({
      event: "admin_image_upload_failed",
      objectKey,
      originalName,
      sizeBytes: bytes.byteLength,
      error: String(error),
    }));
    return fail(request, "storage", 500);
  }
};
