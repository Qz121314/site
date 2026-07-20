import { env } from "cloudflare:workers";
import {
  normalizeConversionTarget,
  type PublicConversionResource,
  type PublicConversionType,
} from "@/lib/public/conversion-target";

export { normalizeConversionTarget } from "@/lib/public/conversion-target";
export type { PublicConversionResource } from "@/lib/public/conversion-target";

type ConversionRow = {
  type: PublicConversionType;
  value: string;
};

function randomIndex(length: number): number {
  if (!Number.isSafeInteger(length) || length <= 0) throw new Error("Invalid random range");
  const range = 0x1_0000_0000;
  const ceiling = range - (range % length);
  const buffer = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0] ?? 0;
  } while (value >= ceiling);
  return value % length;
}

export async function selectProductConversionTarget(
  channelSlug: string,
  productSlug: string,
): Promise<string | null> {
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
     ORDER BY r.id ASC`,
  ).bind(channelSlug, productSlug).all<ConversionRow>();

  const targets = result.results
    .map((resource: PublicConversionResource) => normalizeConversionTarget(resource))
    .filter((target): target is string => Boolean(target));
  return targets.length > 0 ? targets[randomIndex(targets.length)] ?? null : null;
}
