import { env } from "cloudflare:workers";

export async function imageAssetsExist(imageIds: readonly string[]): Promise<boolean> {
  const uniqueIds = [...new Set(imageIds.filter(Boolean))];
  if (uniqueIds.length === 0) return true;
  if (uniqueIds.length > 100) return false;

  const placeholders = uniqueIds.map((_, index) => `?${index + 1}`).join(", ");
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM image_assets WHERE id IN (${placeholders})`,
  ).bind(...uniqueIds).first<{ total: number }>();
  return Number(row?.total ?? 0) === uniqueIds.length;
}

export async function productImageAssetsReady(imageIds: readonly string[]): Promise<boolean> {
  const uniqueIds = [...new Set(imageIds.filter(Boolean))];
  if (uniqueIds.length === 0) return true;
  if (uniqueIds.length > 30) return false;

  const placeholders = uniqueIds.map((_, index) => `?${index + 1}`).join(", ");
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM image_assets
     WHERE id IN (${placeholders})
       AND thumbnail_object_key IS NOT NULL
       AND thumbnail_width IS NOT NULL
       AND thumbnail_height IS NOT NULL`,
  ).bind(...uniqueIds).first<{ total: number }>();
  return Number(row?.total ?? 0) === uniqueIds.length;
}
