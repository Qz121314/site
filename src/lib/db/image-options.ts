import { env } from "cloudflare:workers";
import { buildPublicImageUrl } from "@/lib/images/url";

export type AdminImageOption = {
  id: string;
  objectKey: string;
  originalName: string;
  width: number;
  height: number;
  previewUrl: string;
};

type ImageOptionRow = {
  id: string;
  object_key: string;
  original_name: string;
  width: number;
  height: number;
};

type BaseUrlRow = { r2_public_base_url: string };

export async function loadAdminImageOptions(limit = 1_000): Promise<AdminImageOption[]> {
  const safeLimit = Number.isSafeInteger(limit) ? Math.min(Math.max(limit, 1), 1_000) : 1_000;

  try {
    const [result, settings] = await Promise.all([
      env.DB.prepare(
        `SELECT id, object_key, original_name, width, height
         FROM image_assets
         ORDER BY created_at DESC, id DESC
         LIMIT ?1`,
      ).bind(safeLimit).all<ImageOptionRow>(),
      env.DB.prepare(
        "SELECT r2_public_base_url FROM site_settings WHERE id = 1",
      ).first<BaseUrlRow>(),
    ]);

    const baseUrl = settings?.r2_public_base_url ?? "";
    return result.results.map((image) => ({
      id: image.id,
      objectKey: image.object_key,
      originalName: image.original_name,
      width: Number(image.width),
      height: Number(image.height),
      previewUrl:
        buildPublicImageUrl(baseUrl, image.object_key) ??
        `/api/admin/images/${encodeURIComponent(image.id)}/content`,
    }));
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_image_options_read_failed", error: String(error) }));
    return [];
  }
}

export async function imageAssetsExist(imageIds: readonly string[]): Promise<boolean> {
  const uniqueIds = [...new Set(imageIds.filter(Boolean))];
  if (uniqueIds.length === 0) return true;

  const placeholders = uniqueIds.map((_, index) => `?${index + 1}`).join(", ");
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM image_assets WHERE id IN (${placeholders})`,
  ).bind(...uniqueIds).first<{ total: number }>();
  return Number(row?.total ?? 0) === uniqueIds.length;
}
