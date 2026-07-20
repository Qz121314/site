import { env } from "cloudflare:workers";

export type AdminCategory = {
  id: string;
  channelId: string;
  name: string;
  slug: string;
  imageAssetId: string | null;
  sortOrder: number;
  status: "draft" | "published" | "disabled";
  filterIds: string[];
  productCount: number;
};

type AdminCategoryRow = {
  id: string;
  channel_id: string;
  name: string;
  slug: string;
  image_asset_id: string | null;
  sort_order: number;
  status: AdminCategory["status"];
  filter_ids: string | null;
  product_count: number;
};

export async function loadAdminCategories(channelId: string): Promise<AdminCategory[]> {
  try {
    const result = await env.DB.prepare(
      `SELECT
         c.id,
         c.channel_id,
         c.name,
         c.slug,
         c.image_asset_id,
         c.sort_order,
         c.status,
         GROUP_CONCAT(DISTINCT r.filter_id) AS filter_ids,
         COUNT(DISTINCT p.id) AS product_count
       FROM categories c
       LEFT JOIN category_filter_relations r ON r.category_id = c.id
       LEFT JOIN products p ON p.category_id = c.id AND p.channel_id = c.channel_id
       WHERE c.channel_id = ?1
       GROUP BY c.id, c.channel_id, c.name, c.slug, c.image_asset_id, c.sort_order, c.status
       ORDER BY c.sort_order ASC, c.created_at ASC`,
    ).bind(channelId).all<AdminCategoryRow>();

    return result.results.map((row) => ({
      id: row.id,
      channelId: row.channel_id,
      name: row.name,
      slug: row.slug,
      imageAssetId: row.image_asset_id,
      sortOrder: row.sort_order,
      status: row.status,
      filterIds: row.filter_ids ? row.filter_ids.split(",").filter(Boolean) : [],
      productCount: Number(row.product_count ?? 0),
    }));
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_categories_read_failed", channelId, error: String(error) }));
    return [];
  }
}
