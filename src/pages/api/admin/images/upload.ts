import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import {
  MAX_IMAGE_BYTES,
  MAX_THUMBNAIL_BYTES,
  MAX_THUMBNAIL_DIMENSION,
  MAX_UPLOAD_REQUEST_BYTES,
  createImageObjectKey,
  createImageThumbnailObjectKey,
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
  const thumbnail = form.get("thumbnail");
  const variant = form.get("variant");
  const productVariant = variant === "product";
  const heroVariant = variant === "hero";
  const logoVariant = variant === "logo";
  const faviconVariant = variant === "favicon";
  const responsiveVariant = productVariant || heroVariant || logoVariant || faviconVariant;
  if (variant !== null && !responsiveVariant) return fail(request, "variant");
  if (thumbnail !== null && (!(thumbnail instanceof File) || thumbnail.size === 0)) {
    return fail(request, "thumbnail");
  }
  if (responsiveVariant && !(thumbnail instanceof File)) return fail(request, "thumbnail-required");
  if (thumbnail instanceof File && thumbnail.size > MAX_THUMBNAIL_BYTES) {
    return fail(request, "thumbnail-too-large", 413);
  }

  let bytes: Uint8Array;
  let thumbnailBytes: Uint8Array | null;
  try {
    [bytes, thumbnailBytes] = await Promise.all([
      file.arrayBuffer().then((buffer) => new Uint8Array(buffer)),
      thumbnail instanceof File
        ? thumbnail.arrayBuffer().then((buffer) => new Uint8Array(buffer))
        : Promise.resolve(null),
    ]);
  } catch {
    return fail(request, "read");
  }

  const inspected = inspectImage(bytes, file.type);
  if (!inspected) return fail(request, "format");
  const inspectedThumbnail = thumbnailBytes && thumbnail instanceof File
    ? inspectImage(thumbnailBytes, thumbnail.type)
    : null;
  if (
    thumbnailBytes && (
      !inspectedThumbnail ||
      inspectedThumbnail.mimeType !== "image/webp" ||
      Math.max(inspectedThumbnail.width, inspectedThumbnail.height) > MAX_THUMBNAIL_DIMENSION
    )
  ) {
    return fail(request, "thumbnail-format");
  }

  const id = crypto.randomUUID();
  const objectKey = createImageObjectKey(inspected.extension);
  const thumbnailObjectKey = inspectedThumbnail ? createImageThumbnailObjectKey() : null;
  const originalNameValue = form.get("originalName");
  const originalName = normalizeOriginalName(
    typeof originalNameValue === "string" && originalNameValue.trim() ? originalNameValue : file.name,
  );

  try {
    const writes = [
      env.MEDIA_BUCKET.put(objectKey, bytes, {
        httpMetadata: {
          contentType: inspected.mimeType,
          cacheControl: "public, max-age=31536000, immutable",
        },
        customMetadata: {
          assetId: id,
          width: String(inspected.width),
          height: String(inspected.height),
          originalName,
          variant: "original",
        },
      }),
    ];
    if (thumbnailObjectKey && thumbnailBytes && inspectedThumbnail) {
      writes.push(env.MEDIA_BUCKET.put(thumbnailObjectKey, thumbnailBytes, {
        httpMetadata: {
          contentType: inspectedThumbnail.mimeType,
          cacheControl: "public, max-age=31536000, immutable",
        },
        customMetadata: {
          assetId: id,
          width: String(inspectedThumbnail.width),
          height: String(inspectedThumbnail.height),
          originalName,
          variant: heroVariant
            ? "hero-responsive"
            : logoVariant
              ? "site-logo"
              : faviconVariant
                ? "site-favicon"
                : "directory-thumbnail",
        },
      }));
    }
    await Promise.all(writes);

    try {
      await env.DB.prepare(
        `INSERT INTO image_assets
           (id, object_key, original_name, mime_type, width, height, size_bytes,
            thumbnail_object_key, thumbnail_width, thumbnail_height, thumbnail_size_bytes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      ).bind(
        id,
        objectKey,
        originalName,
        inspected.mimeType,
        inspected.width,
        inspected.height,
        bytes.byteLength,
        thumbnailObjectKey,
        inspectedThumbnail?.width ?? null,
        inspectedThumbnail?.height ?? null,
        thumbnailBytes?.byteLength ?? null,
      ).run();
    } catch (error) {
      await env.MEDIA_BUCKET.delete([objectKey, thumbnailObjectKey].filter(Boolean) as string[]);
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
          thumbnailObjectKey,
          thumbnailWidth: inspectedThumbnail?.width ?? null,
          thumbnailHeight: inspectedThumbnail?.height ?? null,
          thumbnailSizeBytes: thumbnailBytes?.byteLength ?? null,
        },
      });
    }

    return redirect(request, { saved: "uploaded" });
  } catch (error) {
    try {
      await env.MEDIA_BUCKET.delete([objectKey, thumbnailObjectKey].filter(Boolean) as string[]);
    } catch (cleanupError) {
      console.error(JSON.stringify({
        event: "admin_image_upload_cleanup_failed",
        objectKey,
        thumbnailObjectKey,
        error: String(cleanupError),
      }));
    }
    console.error(JSON.stringify({
      event: "admin_image_upload_failed",
      objectKey,
      thumbnailObjectKey,
      originalName,
      sizeBytes: bytes.byteLength,
      error: String(error),
    }));
    return fail(request, "storage", 500);
  }
};
