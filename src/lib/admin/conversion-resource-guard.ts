import { env } from "cloudflare:workers";

type ConversionResourceGuardRow = {
  published_products: number;
  other_enabled_resources: number;
};

export async function wouldRemoveLastEnabledConversionResource(
  channelId: string,
  groupId: string,
  resourceId: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT
       EXISTS(
         SELECT 1
         FROM products
         WHERE channel_id = ?1
           AND conversion_group_id = ?2
           AND status = 'published'
       ) AS published_products,
       EXISTS(
         SELECT 1
         FROM conversion_resources
         WHERE group_id = ?2
           AND id <> ?3
           AND status = 'enabled'
       ) AS other_enabled_resources`,
  ).bind(channelId, groupId, resourceId).first<ConversionResourceGuardRow>();

  return Boolean(row?.published_products) && !Boolean(row?.other_enabled_resources);
}
