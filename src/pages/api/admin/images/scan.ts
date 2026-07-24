import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import {
  MAX_IMAGE_DIMENSION,
  MAX_THUMBNAIL_DIMENSION,
  isSupportedImageType,
  normalizeOriginalName,
} from "@/lib/admin/image-form";

export const prerender = false;

const MAX_SCAN_OBJECTS = 1_000;
const TARGET_MUTATIONS_PER_REQUEST = 50;
const R2_LIST_PAGE_SIZE = 50;
const D1_IMPORT_ROWS_PER_QUERY = 14;
const MAX_CURSOR_LENGTH = 2_048;
const ASSET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RESTORABLE_DERIVATIVE_VARIANTS = new Set([
  "directory-thumbnail",
  "hero-responsive",
  "site-logo",
  "site-favicon",
]);

type KnownObjectRow = {
  image_id: string;
  object_key: string;
  has_thumbnail: number;
};

type ImportCandidate = {
  id: string;
  objectKey: string;
  originalName: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
};

type ThumbnailCandidate = {
  assetId: string;
  objectKey: string;
  width: number;
  height: number;
  sizeBytes: number;
};

function redirect(request: Request, params: Record<string, string>): Response {
  const url = new URL("/admin/images", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

function parseDimension(value: string | undefined, maximum = MAX_IMAGE_DIMENSION): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= maximum ? number : null;
}

function parseAssetId(value: string | undefined): string | null {
  const assetId = value?.trim() ?? "";
  return ASSET_ID_PATTERN.test(assetId) ? assetId : null;
}

function parseCursor(form: FormData): string | undefined {
  const value = form.get("cursor");
  if (typeof value !== "string") return undefined;
  const cursor = value.trim();
  return cursor && cursor.length <= MAX_CURSOR_LENGTH ? cursor : undefined;
}

function chunk<T>(items: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size));
  return output;
}

function importStatement(images: ImportCandidate[]) {
  const bindings = images.flatMap((image) => [
    image.id,
    image.objectKey,
    image.originalName,
    image.mimeType,
    image.width,
    image.height,
    image.sizeBytes,
  ]);
  let parameter = 1;
  const values = images.map(() => {
    const row = Array.from({ length: 7 }, () => `?${parameter++}`);
    return `(${row.join(", ")})`;
  }).join(", ");
  return env.DB.prepare(
    `INSERT OR IGNORE INTO image_assets
       (id, object_key, original_name, mime_type, width, height, size_bytes)
     VALUES ${values}`,
  ).bind(...bindings);
}

function thumbnailStatement(image: ThumbnailCandidate) {
  return env.DB.prepare(
    `UPDATE image_assets
     SET thumbnail_object_key = ?2,
         thumbnail_width = ?3,
         thumbnail_height = ?4,
         thumbnail_size_bytes = ?5
     WHERE id = ?1
       AND thumbnail_object_key IS NULL`,
  ).bind(image.assetId, image.objectKey, image.width, image.height, image.sizeBytes);
}

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const form = await request.formData();
  let cursor = parseCursor(form);

  try {
    const existingResult = await env.DB.prepare(
      `SELECT
         id AS image_id,
         object_key,
         CASE WHEN thumbnail_object_key IS NULL THEN 0 ELSE 1 END AS has_thumbnail
       FROM image_assets
       UNION ALL
       SELECT id AS image_id, thumbnail_object_key AS object_key, 1 AS has_thumbnail
       FROM image_assets
       WHERE thumbnail_object_key IS NOT NULL
       UNION ALL
       SELECT image_id, object_key, 1 AS has_thumbnail
       FROM image_deletion_queue`,
    ).all<KnownObjectRow>();
    const knownKeys = new Set(existingResult.results.map((row) => row.object_key));
    const knownIds = new Set(existingResult.results.map((row) => row.image_id));
    const idsWithThumbnail = new Set(
      existingResult.results.filter((row) => row.has_thumbnail === 1).map((row) => row.image_id),
    );
    const candidates: ImportCandidate[] = [];
    const thumbnails: ThumbnailCandidate[] = [];
    let skipped = 0;
    let scanned = 0;

    do {
      const result = await env.MEDIA_BUCKET.list({
        prefix: "images/",
        limit: Math.min(R2_LIST_PAGE_SIZE, MAX_SCAN_OBJECTS - scanned),
        include: ["httpMetadata", "customMetadata"],
        ...(cursor ? { cursor } : {}),
      });
      const unknownObjects = result.objects.filter((object) => {
        scanned += 1;
        return !knownKeys.has(object.key);
      });

      for (const object of unknownObjects) {
        const variant = object.customMetadata?.variant ?? "";
        if (RESTORABLE_DERIVATIVE_VARIANTS.has(variant)) continue;

        const mimeType = object.httpMetadata?.contentType ?? "";
        const width = parseDimension(object.customMetadata?.width);
        const height = parseDimension(object.customMetadata?.height);
        if (!isSupportedImageType(mimeType) || !width || !height) {
          skipped += 1;
          continue;
        }

        const metadataAssetId = parseAssetId(object.customMetadata?.assetId);
        if (metadataAssetId && knownIds.has(metadataAssetId)) {
          skipped += 1;
          continue;
        }
        const id = metadataAssetId ?? crypto.randomUUID();
        const originalName = normalizeOriginalName(
          object.customMetadata?.originalName ?? object.key.split("/").pop() ?? "image",
        );
        candidates.push({
          id,
          objectKey: object.key,
          originalName,
          mimeType,
          width,
          height,
          sizeBytes: object.size,
        });
        knownIds.add(id);
        knownKeys.add(object.key);
      }

      for (const object of unknownObjects) {
        const variant = object.customMetadata?.variant ?? "";
        if (!RESTORABLE_DERIVATIVE_VARIANTS.has(variant)) continue;

        const assetId = parseAssetId(object.customMetadata?.assetId);
        const width = parseDimension(object.customMetadata?.width, MAX_THUMBNAIL_DIMENSION);
        const height = parseDimension(object.customMetadata?.height, MAX_THUMBNAIL_DIMENSION);
        const mimeType = object.httpMetadata?.contentType ?? "";
        if (
          !assetId
          || !knownIds.has(assetId)
          || idsWithThumbnail.has(assetId)
          || mimeType !== "image/webp"
          || !width
          || !height
        ) {
          skipped += 1;
          continue;
        }

        thumbnails.push({
          assetId,
          objectKey: object.key,
          width,
          height,
          sizeBytes: object.size,
        });
        idsWithThumbnail.add(assetId);
        knownKeys.add(object.key);
      }

      cursor = result.truncated ? result.cursor : undefined;
      if (!cursor || candidates.length + thumbnails.length >= TARGET_MUTATIONS_PER_REQUEST) break;
    } while (scanned < MAX_SCAN_OBJECTS);

    const groups = chunk(candidates, D1_IMPORT_ROWS_PER_QUERY);
    const statements = [
      ...groups.map(importStatement),
      ...thumbnails.map(thumbnailStatement),
    ];
    if (statements.length > 0) await env.DB.batch(statements);

    return redirect(request, {
      saved: "scanned",
      imported: String(candidates.length),
      skipped: String(skipped),
      ...(cursor ? { partial: "1", cursor } : {}),
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_image_scan_failed", error: String(error) }));
    return redirect(request, { error: "scan" });
  }
};
