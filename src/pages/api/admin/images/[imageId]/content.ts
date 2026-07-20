import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { loadAdminImageObject } from "@/lib/db/images";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const imageId = params.imageId ?? "";
  if (!imageId) return new Response("Not Found", { status: 404 });

  try {
    const image = await loadAdminImageObject(imageId);
    if (!image) return new Response("Not Found", { status: 404 });

    const object = await env.MEDIA_BUCKET.get(image.objectKey);
    if (!object) return new Response("Not Found", { status: 404 });

    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType ?? image.mimeType,
        "Content-Length": String(object.size),
        ETag: object.httpEtag,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_image_content_failed", imageId, error: String(error) }));
    return new Response("Image unavailable", { status: 500 });
  }
};
