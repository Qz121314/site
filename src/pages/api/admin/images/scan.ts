import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { isSameOriginPost } from "@/lib/auth/session";
import {
  MAX_IMAGE_DIMENSION,
  isSupportedImageType,
  normalizeOriginalName,
} from "@/lib/admin/image-form";

export const prerender = false;

const MAX_SCAN_OBJECTS = 1_000;
const TARGET_IMPORTS_PER_REQUEST = 100;
const R2_LIST_PAGE_SIZE = 50;
const D1_IMPORT_ROWS_PER_QUERY = 14;
const MAX_CURSOR_LENGTH = 2_048;

type ObjectKeyRow = { object_key: string };

type ImportCandidate = {
  id: string;
  objectKey: string;
  originalName: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
};

function redirect(request: Request, params: Record<string, string>): Response {
  const url = new URL("/admin/images", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 303);
}

function parseDimension(value: string | undefined): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= MAX_IMAGE_DIMENSION ? number : null;
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

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginPost(request)) return new Response("Forbidden", { status: 403 });

  const form = await request.formData();
  let cursor = parseCursor(form);

  try {
    const existingResult = await env.DB.prepare("SELECT object_key FROM image_assets").all<ObjectKeyRow>();
    const knownKeys = new Set(existingResult.results.map((row) => row.object_key));
    const candidates: ImportCandidate[] = [];
    let skipped = 0;
    let scanned = 0;

    do {
      const result = await env.MEDIA_BUCKET.list({
        prefix: "images/",
        limit: Math.min(R2_LIST_PAGE_SIZE, MAX_SCAN_OBJECTS - scanned),
        include: ["httpMetadata", "customMetadata"],
        ...(cursor ? { cursor } : {}),
      });

      for (const object of result.objects) {
        scanned += 1;
        if (knownKeys.has(object.key)) continue;

        const mimeType = object.httpMetadata?.contentType ?? "";
        const width = parseDimension(object.customMetadata?.width);
        const height = parseDimension(object.customMetadata?.height);
        if (!isSupportedImageType(mimeType) || !width || !height) {
          skipped += 1;
          continue;
        }

        const originalName = normalizeOriginalName(
          object.customMetadata?.originalName ?? object.key.split("/").pop() ?? "image",
        );
        candidates.push({
          id: crypto.randomUUID(),
          objectKey: object.key,
          originalName,
          mimeType,
          width,
          height,
          sizeBytes: object.size,
        });
        knownKeys.add(object.key);
      }

      cursor = result.truncated ? result.cursor : undefined;
      if (!cursor || candidates.length >= TARGET_IMPORTS_PER_REQUEST) break;
    } while (scanned < MAX_SCAN_OBJECTS);

    const groups = chunk(candidates, D1_IMPORT_ROWS_PER_QUERY);
    if (groups.length > 0) {
      await env.DB.batch(groups.map(importStatement));
    }

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
