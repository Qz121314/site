import { env } from "cloudflare:workers";
import { MAX_IMAGE_MUTATION_IDS, type AdminImageObject, type ImageDeleteResult } from "@/lib/db/images";

type ImageObjectRow = {
  id: string;
  object_key: string;
  thumbnail_object_key: string | null;
  mime_type: string;
};

type QueuedImageRow = {
  image_id: string;
  object_key: string;
  mime_type: string;
};

export type R2ImageDeleteResult = {
  completed: AdminImageObject[];
  pending: AdminImageObject[];
};

function mapImage(row: ImageObjectRow): AdminImageObject {
  return {
    id: row.id,
    objectKey: row.object_key,
    thumbnailObjectKey: row.thumbnail_object_key,
    mimeType: row.mime_type,
  };
}

function mapQueuedImage(row: QueuedImageRow): AdminImageObject {
  return {
    id: row.image_id,
    objectKey: row.object_key,
    thumbnailObjectKey: null,
    mimeType: row.mime_type,
  };
}

function uniqueImages(images: readonly AdminImageObject[]): AdminImageObject[] {
  return [...new Map(images.filter((image) => image.objectKey).map((image) => [image.objectKey, image])).values()];
}

function imageObjectKeys(images: readonly AdminImageObject[]): string[] {
  return [...new Set(images.flatMap((image) => [image.objectKey, image.thumbnailObjectKey].filter(Boolean) as string[]))];
}

function placeholders(count: number, start = 1): string {
  return Array.from({ length: count }, (_, index) => `?${index + start}`).join(", ");
}

async function clearDeletionQueue(objectKeys: readonly string[]): Promise<void> {
  for (let index = 0; index < objectKeys.length; index += MAX_IMAGE_MUTATION_IDS) {
    const group = objectKeys.slice(index, index + MAX_IMAGE_MUTATION_IDS);
    await env.DB.prepare(
      `DELETE FROM image_deletion_queue WHERE object_key IN (${placeholders(group.length)})`,
    ).bind(...group).run();
  }
}

async function markDeletionFailure(objectKeys: readonly string[], error: unknown): Promise<void> {
  const message = String(error).slice(0, 500);
  const maximumKeysPerStatement = MAX_IMAGE_MUTATION_IDS - 1;
  for (let index = 0; index < objectKeys.length; index += maximumKeysPerStatement) {
    const group = objectKeys.slice(index, index + maximumKeysPerStatement);
    await env.DB.prepare(
      `UPDATE image_deletion_queue
       SET attempt_count = attempt_count + 1,
           last_error = ?1,
           updated_at = CURRENT_TIMESTAMP
       WHERE object_key IN (${placeholders(group.length, 2)})`,
    ).bind(message, ...group).run();
  }
}

export async function deleteQueuedImageObjectsFromR2(
  images: readonly AdminImageObject[],
): Promise<R2ImageDeleteResult> {
  const unique = uniqueImages(images);
  if (unique.length === 0) return { completed: [], pending: [] };

  const objectKeys = imageObjectKeys(unique);
  try {
    await env.MEDIA_BUCKET.delete(objectKeys);
    await clearDeletionQueue(objectKeys);
    return { completed: unique, pending: [] };
  } catch (error) {
    try {
      await markDeletionFailure(objectKeys, error);
    } catch (queueError) {
      console.error(JSON.stringify({
        event: "image_deletion_queue_failure_update_failed",
        objectKeys,
        error: String(queueError),
      }));
    }
    return { completed: [], pending: unique };
  }
}

export async function loadQueuedImageObjects(limit = MAX_IMAGE_MUTATION_IDS): Promise<AdminImageObject[]> {
  const safeLimit = Number.isSafeInteger(limit)
    ? Math.max(1, Math.min(limit, MAX_IMAGE_MUTATION_IDS))
    : MAX_IMAGE_MUTATION_IDS;
  const result = await env.DB.prepare(
    `SELECT image_id, object_key, mime_type
     FROM image_deletion_queue
     ORDER BY updated_at ASC, object_key ASC
     LIMIT ?1`,
  ).bind(safeLimit).all<QueuedImageRow>();
  return result.results.map(mapQueuedImage);
}

export async function deleteUnusedImageAssetsAtomically(
  imageIds: readonly string[],
): Promise<ImageDeleteResult> {
  const uniqueIds = [...new Set(imageIds.filter(Boolean))];
  if (uniqueIds.length === 0 || uniqueIds.length > MAX_IMAGE_MUTATION_IDS) {
    return { found: [], deleted: [], remainingIds: uniqueIds };
  }

  const idPlaceholders = placeholders(uniqueIds.length);
  const allCandidatesExist = `(SELECT COUNT(*) FROM image_assets candidate WHERE candidate.id IN (${idPlaceholders})) = ${uniqueIds.length}`;
  const anyCandidateReferenced = `EXISTS (
    SELECT 1
    FROM image_assets candidate
    WHERE candidate.id IN (${idPlaceholders})
      AND (
        EXISTS (SELECT 1 FROM site_settings s WHERE s.logo_asset_id = candidate.id OR s.favicon_asset_id = candidate.id)
        OR EXISTS (SELECT 1 FROM products p WHERE p.cover_asset_id = candidate.id)
        OR EXISTS (SELECT 1 FROM product_images pi WHERE pi.image_asset_id = candidate.id)
        OR EXISTS (SELECT 1 FROM advertisements ad WHERE ad.image_asset_id = candidate.id)
      )
  )`;

  const results = await env.DB.batch([
    env.DB.prepare(
      `SELECT id, object_key, thumbnail_object_key, mime_type
       FROM image_assets
       WHERE id IN (${idPlaceholders})`,
    ).bind(...uniqueIds),
    env.DB.prepare(
      `INSERT OR IGNORE INTO image_deletion_queue (object_key, image_id, mime_type)
       SELECT object_key, id, mime_type
       FROM image_assets
       WHERE id IN (${idPlaceholders})
         AND ${allCandidatesExist}
         AND NOT ${anyCandidateReferenced}
       UNION ALL
       SELECT thumbnail_object_key, id, 'image/webp'
       FROM image_assets
       WHERE id IN (${idPlaceholders})
         AND thumbnail_object_key IS NOT NULL
         AND ${allCandidatesExist}
         AND NOT ${anyCandidateReferenced}`,
    ).bind(...uniqueIds),
    env.DB.prepare(
      `DELETE FROM image_assets
       WHERE id IN (${idPlaceholders})
         AND ${allCandidatesExist}
         AND NOT ${anyCandidateReferenced}`,
    ).bind(...uniqueIds),
    env.DB.prepare(
      `SELECT id FROM image_assets WHERE id IN (${idPlaceholders})`,
    ).bind(...uniqueIds),
  ]);

  const foundResult = results[0];
  const remainingResult = results[3];
  if (!foundResult || !remainingResult) throw new Error("Incomplete D1 image delete batch result");

  const found = (foundResult.results as ImageObjectRow[]).map(mapImage);
  const remainingIds = (remainingResult.results as Array<{ id: string }>).map((row) => row.id);
  const remaining = new Set(remainingIds);
  return {
    found,
    deleted: found.filter((image) => !remaining.has(image.id)),
    remainingIds,
  };
}
