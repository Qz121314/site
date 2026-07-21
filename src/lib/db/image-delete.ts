import { env } from "cloudflare:workers";
import { MAX_IMAGE_MUTATION_IDS, type AdminImageObject, type ImageDeleteResult } from "@/lib/db/images";

type ImageObjectRow = {
  id: string;
  object_key: string;
  mime_type: string;
};

function mapImage(row: ImageObjectRow): AdminImageObject {
  return { id: row.id, objectKey: row.object_key, mimeType: row.mime_type };
}

export async function deleteUnusedImageAssetsAtomically(
  imageIds: readonly string[],
): Promise<ImageDeleteResult> {
  const uniqueIds = [...new Set(imageIds.filter(Boolean))];
  if (uniqueIds.length === 0 || uniqueIds.length > MAX_IMAGE_MUTATION_IDS) {
    return { found: [], deleted: [], remainingIds: uniqueIds };
  }

  const placeholders = uniqueIds.map((_, index) => `?${index + 1}`).join(", ");
  const results = await env.DB.batch([
    env.DB.prepare(
      `SELECT id, object_key, mime_type
       FROM image_assets
       WHERE id IN (${placeholders})`,
    ).bind(...uniqueIds),
    env.DB.prepare(
      `DELETE FROM image_assets
       WHERE id IN (${placeholders})
         AND (SELECT COUNT(*) FROM image_assets candidate WHERE candidate.id IN (${placeholders})) = ${uniqueIds.length}
         AND NOT EXISTS (
           SELECT 1
           FROM image_assets candidate
           WHERE candidate.id IN (${placeholders})
             AND (
               EXISTS (SELECT 1 FROM site_settings s WHERE s.logo_asset_id = candidate.id OR s.favicon_asset_id = candidate.id)
               OR EXISTS (SELECT 1 FROM categories c WHERE c.image_asset_id = candidate.id)
               OR EXISTS (SELECT 1 FROM products p WHERE p.cover_asset_id = candidate.id)
               OR EXISTS (SELECT 1 FROM product_images pi WHERE pi.image_asset_id = candidate.id)
               OR EXISTS (SELECT 1 FROM advertisements ad WHERE ad.image_asset_id = candidate.id)
             )
         )`,
    ).bind(...uniqueIds),
    env.DB.prepare(
      `SELECT id FROM image_assets WHERE id IN (${placeholders})`,
    ).bind(...uniqueIds),
  ]);

  const foundResult = results[0];
  const remainingResult = results[2];
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
