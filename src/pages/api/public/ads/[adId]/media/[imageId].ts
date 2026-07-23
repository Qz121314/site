import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { loadPublicAdvertisementImage } from "@/lib/db/public-ads";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const advertisementId = params.adId ?? "";
  const imageAssetId = params.imageId ?? "";
  if (!advertisementId || !imageAssetId) return new Response("Not Found", { status: 404 });

  try {
    const image = await loadPublicAdvertisementImage(advertisementId, imageAssetId);
    if (!image) return new Response("Not Found", { status: 404 });

    const object = await env.MEDIA_BUCKET.get(image.object_key);
    if (!object) return new Response("Not Found", { status: 404 });

    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType ?? image.mime_type,
        "Content-Length": String(object.size),
        ETag: object.httpEtag,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Cloudflare-CDN-Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "public_ad_media_read_failed",
      advertisementId,
      imageAssetId,
      error: String(error),
    }));
    return new Response("Image unavailable", { status: 500 });
  }
};
