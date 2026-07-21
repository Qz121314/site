import { env } from "cloudflare:workers";
import { MAX_CATEGORY_FILTERS } from "@/lib/admin/bulk-relations";

export async function categoryFiltersBelongToChannel(
  channelId: string,
  filterIds: readonly string[],
): Promise<boolean> {
  const uniqueIds = [...new Set(filterIds.filter(Boolean))];
  if (uniqueIds.length !== filterIds.length || uniqueIds.length > MAX_CATEGORY_FILTERS) return false;
  if (uniqueIds.length === 0) return true;

  const placeholders = uniqueIds.map((_, index) => `?${index + 2}`).join(", ");
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM category_filters
     WHERE channel_id = ?1
       AND status = 'enabled'
       AND id IN (${placeholders})`,
  ).bind(channelId, ...uniqueIds).first<{ count: number }>();

  return Number(row?.count ?? 0) === uniqueIds.length;
}
