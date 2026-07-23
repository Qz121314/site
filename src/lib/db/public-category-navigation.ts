import { env } from "cloudflare:workers";

type NavigationRow = { enabled: number };

export async function hasPublicCategoryNavigation(channelId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT EXISTS(
       SELECT 1
       FROM category_filter_relations relation
       INNER JOIN category_filters filter
         ON filter.id = relation.filter_id
        AND filter.channel_id = ?1
        AND filter.status = 'enabled'
       INNER JOIN categories category
         ON category.id = relation.category_id
        AND category.channel_id = ?1
        AND category.status = 'published'
       WHERE EXISTS (
         SELECT 1
         FROM products product
         WHERE product.channel_id = ?1
           AND product.category_id = category.id
           AND product.status = 'published'
       )
       LIMIT 1
     ) AS enabled`,
  ).bind(channelId).first<NavigationRow>();

  return Boolean(row?.enabled);
}
