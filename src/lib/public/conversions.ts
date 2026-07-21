import { env } from "cloudflare:workers";
import { secureRandomIndex } from "@/lib/public/random-index";
import {
  normalizeConversionResource,
  type PublicConversionContact,
  type PublicConversionResource,
  type PublicConversionType,
} from "@/lib/public/conversion-target";

export { normalizeConversionResource, normalizeConversionTarget } from "@/lib/public/conversion-target";
export type { PublicConversionContact, PublicConversionResource } from "@/lib/public/conversion-target";

type ConversionRow = {
  type: PublicConversionType;
  value: string;
};

export async function selectProductConversionContact(
  channelSlug: string,
  productSlug: string,
): Promise<PublicConversionContact | null> {
  const result = await env.DB.prepare(
    `SELECT r.type, r.value
     FROM products p
     INNER JOIN channels c
       ON c.id = p.channel_id
      AND c.slug = ?1
      AND c.status = 'published'
     INNER JOIN conversion_groups g
       ON g.id = p.conversion_group_id
      AND g.channel_id = p.channel_id
      AND g.status = 'enabled'
     INNER JOIN conversion_resources r
       ON r.group_id = g.id
      AND r.status = 'enabled'
     LEFT JOIN categories category
       ON category.id = p.category_id
      AND category.channel_id = p.channel_id
     WHERE p.slug = ?2
       AND p.status = 'published'
       AND (p.category_id IS NULL OR category.status = 'published')
     ORDER BY r.sort_order ASC, r.created_at ASC, r.id ASC`,
  ).bind(channelSlug, productSlug).all<ConversionRow>();

  const contacts = result.results
    .map((resource: PublicConversionResource) => normalizeConversionResource(resource))
    .filter((contact): contact is PublicConversionContact => Boolean(contact));

  return contacts.length > 0 ? contacts[secureRandomIndex(contacts.length)] ?? null : null;
}
