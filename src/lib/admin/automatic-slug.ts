import { env } from "cloudflare:workers";
import { automaticSlug, selectUniqueSlug } from "@/lib/admin/slug-utils";

export { automaticSlug, selectUniqueSlug } from "@/lib/admin/slug-utils";

const MAX_SLUG_ATTEMPTS = 1_000;
const MAX_SUFFIX_LENGTH = 5;

type SlugRow = { slug: string };

function lookupBounds(base: string, maxLength: number): [string, string] {
  const lower = base.slice(0, Math.max(1, maxLength - MAX_SUFFIX_LENGTH));
  return [lower, `${lower}{`];
}

async function uniqueFromRows(
  base: string,
  maxLength: number,
  rowsPromise: Promise<{ results: SlugRow[] }>,
): Promise<string> {
  const rows = await rowsPromise;
  return selectUniqueSlug(base, maxLength, rows.results.map((row) => row.slug));
}

export function uniqueChannelSlug(name: string, excludeId: string | null = null): Promise<string> {
  const maxLength = 64;
  const base = automaticSlug(name, "section", maxLength);
  const [lower, upper] = lookupBounds(base, maxLength);
  return uniqueFromRows(
    base,
    maxLength,
    env.DB.prepare(
      `SELECT slug FROM channels
       WHERE slug >= ?1 AND slug < ?2
         AND (?3 IS NULL OR id <> ?3)
       LIMIT ?4`,
    ).bind(lower, upper, excludeId, MAX_SLUG_ATTEMPTS).all<SlugRow>(),
  );
}

export function uniqueFilterSlug(channelId: string, name: string, excludeId: string | null = null): Promise<string> {
  const maxLength = 64;
  const base = automaticSlug(name, "filter", maxLength);
  const [lower, upper] = lookupBounds(base, maxLength);
  return uniqueFromRows(
    base,
    maxLength,
    env.DB.prepare(
      `SELECT slug FROM category_filters
       WHERE channel_id = ?1
         AND slug >= ?2 AND slug < ?3
         AND (?4 IS NULL OR id <> ?4)
       LIMIT ?5`,
    ).bind(channelId, lower, upper, excludeId, MAX_SLUG_ATTEMPTS).all<SlugRow>(),
  );
}

export function uniqueCategorySlug(channelId: string, name: string): Promise<string> {
  const maxLength = 64;
  const base = automaticSlug(name, "category", maxLength);
  const [lower, upper] = lookupBounds(base, maxLength);
  return uniqueFromRows(
    base,
    maxLength,
    env.DB.prepare(
      `SELECT slug FROM categories
       WHERE channel_id = ?1
         AND slug >= ?2 AND slug < ?3
       LIMIT ?4`,
    ).bind(channelId, lower, upper, MAX_SLUG_ATTEMPTS).all<SlugRow>(),
  );
}

export function uniqueProductSlug(channelId: string, title: string, excludeId: string | null = null): Promise<string> {
  const maxLength = 96;
  const base = automaticSlug(title, "product", maxLength);
  const [lower, upper] = lookupBounds(base, maxLength);
  return uniqueFromRows(
    base,
    maxLength,
    env.DB.prepare(
      `SELECT slug FROM products
       WHERE channel_id = ?1
         AND slug >= ?2 AND slug < ?3
         AND (?4 IS NULL OR id <> ?4)
       LIMIT ?5`,
    ).bind(channelId, lower, upper, excludeId, MAX_SLUG_ATTEMPTS).all<SlugRow>(),
  );
}
