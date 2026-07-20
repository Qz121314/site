import { env } from "cloudflare:workers";
import type {
  ConversionGroupStatus,
  ConversionResourceStatus,
  ConversionResourceType,
} from "@/lib/admin/conversion-form";

export type AdminConversionResource = {
  id: string;
  groupId: string;
  type: ConversionResourceType;
  value: string;
  sortOrder: number;
  status: ConversionResourceStatus;
};

export type AdminConversionGroup = {
  id: string;
  channelId: string;
  name: string;
  status: ConversionGroupStatus;
  resourceCount: number;
  enabledResourceCount: number;
  productCount: number;
  resources: AdminConversionResource[];
};

type AdminConversionGroupRow = {
  id: string;
  channel_id: string;
  name: string;
  status: ConversionGroupStatus;
  resource_count: number;
  enabled_resource_count: number;
  product_count: number;
};

type AdminConversionResourceRow = {
  id: string;
  group_id: string;
  type: ConversionResourceType;
  value: string;
  sort_order: number;
  status: ConversionResourceStatus;
};

export async function loadAdminConversionGroups(channelId: string): Promise<AdminConversionGroup[]> {
  try {
    const [groupResult, resourceResult] = await Promise.all([
      env.DB.prepare(
        `SELECT
           g.id,
           g.channel_id,
           g.name,
           g.status,
           COUNT(DISTINCT r.id) AS resource_count,
           COUNT(DISTINCT CASE WHEN r.status = 'enabled' THEN r.id END) AS enabled_resource_count,
           COUNT(DISTINCT p.id) AS product_count
         FROM conversion_groups g
         LEFT JOIN conversion_resources r ON r.group_id = g.id
         LEFT JOIN products p
           ON p.conversion_group_id = g.id
          AND p.channel_id = g.channel_id
         WHERE g.channel_id = ?1
         GROUP BY g.id, g.channel_id, g.name, g.status, g.created_at
         ORDER BY g.created_at ASC`,
      ).bind(channelId).all<AdminConversionGroupRow>(),
      env.DB.prepare(
        `SELECT r.id, r.group_id, r.type, r.value, r.sort_order, r.status
         FROM conversion_resources r
         INNER JOIN conversion_groups g ON g.id = r.group_id
         WHERE g.channel_id = ?1
         ORDER BY g.created_at ASC, r.sort_order ASC, r.created_at ASC`,
      ).bind(channelId).all<AdminConversionResourceRow>(),
    ]);

    const groups = groupResult.results.map((row) => ({
      id: row.id,
      channelId: row.channel_id,
      name: row.name,
      status: row.status,
      resourceCount: Number(row.resource_count ?? 0),
      enabledResourceCount: Number(row.enabled_resource_count ?? 0),
      productCount: Number(row.product_count ?? 0),
      resources: [] as AdminConversionResource[],
    }));

    const groupMap = new Map(groups.map((group) => [group.id, group]));
    for (const row of resourceResult.results) {
      groupMap.get(row.group_id)?.resources.push({
        id: row.id,
        groupId: row.group_id,
        type: row.type,
        value: row.value,
        sortOrder: row.sort_order,
        status: row.status,
      });
    }

    return groups;
  } catch (error) {
    console.error(JSON.stringify({ event: "admin_conversion_groups_read_failed", channelId, error: String(error) }));
    return [];
  }
}
